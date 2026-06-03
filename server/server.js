'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// LOE Builder Pro v19.0 — Node.js / Express / SQLite Backend
// ─────────────────────────────────────────────────────────────────────────────
// Serves the v19 static files AND provides a REST API for:
//   • Authentication  (POST /api/auth/login, POST /api/auth/logout)
//   • User management (GET/POST /api/users, PUT /api/users/:u/password, DELETE /api/users/:u)
//   • LOE database    (GET/PUT /api/db)
//   • Audit log       (GET/POST/DELETE /api/audit)
//   • Health check    (GET /api/health)
//
// Data is persisted to a SQLite database in server/data/loe_database.sqlite.
// Sessions are kept in process memory (Map).
//
// ── Start ────────────────────────────────────────────────────────────────────
// cd server && npm install && npm start
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── File paths ────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PUBLIC_LOE_DIR = path.join(__dirname, 'public', 'loes');
if (!fs.existsSync(PUBLIC_LOE_DIR)) fs.mkdirSync(PUBLIC_LOE_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'loe_database.sqlite');
const db = new sqlite3.Database(DB_FILE);

// ── SQLite Promise Wrappers ───────────────────────────────────────────────────
const dbRun = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) { err ? reject(err) : resolve(this); });
});
const dbGet = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbAll = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// ── Initialize Database ───────────────────────────────────────────────────────
async function initDB() {
    await dbRun(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, user TEXT, action TEXT, details TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS saved_loes (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT, project TEXT, version INTEGER, created_at TEXT, data TEXT, is_final INTEGER DEFAULT 0, public_link TEXT)`);
	
    // Default admin password is "password123"
    const admin = await dbGet(`SELECT username FROM users WHERE username = 'admin'`);
    if (!admin) {
        const hash = crypto.createHash('sha256').update('password123').digest('hex');
        await dbRun(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', hash]);
        console.log('Created default admin account.');
    }

    // Default DB Structure
    const store = await dbGet(`SELECT id FROM store WHERE id = 1`);
    if (!store) {
        const defaultData = JSON.stringify({
            versions: [{ id: 1, name: 'v19.0', timestamp: Date.now(), data: {} }],
            currentVersionId: 1
        });
        await dbRun(`INSERT INTO store (id, data) VALUES (1, ?)`, [defaultData]);
        console.log('Initialized default LOE database structure.');
    }
}
initDB().catch(err => console.error('Database initialization failed:', err));

// ── In-memory session store ───────────────────────────────────────────────────
const sessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours in ms

setInterval(() => {
    const now = Date.now();
    for (const [token, sess] of sessions) {
        if (now - sess.createdAt > SESSION_TTL) sessions.delete(token);
    }
}, 15 * 60 * 1000);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..'))); // server static files

function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Unauthorised: no token provided' });

    const sess = sessions.get(token);
    if (!sess) return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
    if (Date.now() - sess.createdAt > SESSION_TTL) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Session expired — please log in again' });
    }
    req.user = sess.username;
    next();
}

// Extract user for public routes (so unauthenticated LOE saves map to "Public User" instead of crashing)
function getOptionalUser(req) {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
    const sess = sessions.get(token);
    return sess ? sess.username : 'Public User';
}
// ── Audit helper ──────────────────────────────────────────────────────────────
async function addAudit(user, action, details) {
    const time = new Date().toLocaleString();
    try {
        await dbRun(`INSERT INTO audit (time, user, action, details) VALUES (?, ?, ?, ?)`, [time, user, action, details || '']);
        const countRow = await dbGet(`SELECT COUNT(*) as count FROM audit`);
        if (countRow.count > 1000) {
            await dbRun(`DELETE FROM audit WHERE id IN (SELECT id FROM audit ORDER BY id ASC LIMIT ?)`, [countRow.count - 1000]);
        }
    } catch (e) {
        console.error('Audit logging failed:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '18.0', uptime: process.uptime(), time: new Date().toISOString() });
});

// ── Authentication ────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    try {
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        const user = await dbGet(`SELECT username FROM users WHERE username = ? AND password = ?`, [username, hash]);
        
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, { username, createdAt: Date.now() });
        await addAudit(username, 'Login', 'Successful login');
        res.json({ token, username });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
    sessions.delete(token);
    await addAudit(req.user, 'Logout', 'User logged out');
    res.json({ ok: true });
});

// ── User management ───────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, async (_req, res) => {
    try {
        const users = await dbAll(`SELECT username FROM users`);
        res.json(users.map(u => u.username));
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/users', requireAuth, async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) return res.status(400).json({ error: 'Username must be 2–32 chars' });

    try {
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        await dbRun(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash]);
        await addAudit(req.user, 'User Management', `Added user: ${username}`);
        res.json({ ok: true });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: `User "${username}" already exists` });
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/users/:username/password', requireAuth, async (req, res) => {
    const { username } = req.params;
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'New password is required' });

    try {
        const user = await dbGet(`SELECT username FROM users WHERE username = ?`, [username]);
        if (!user) return res.status(404).json({ error: `User "${username}" not found` });

        const hash = crypto.createHash('sha256').update(password).digest('hex');
        await dbRun(`UPDATE users SET password = ? WHERE username = ?`, [hash, username]);
        await addAudit(req.user, 'User Management', `Password changed for: ${username}`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
});

app.delete('/api/users/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
    if (username === 'admin') return res.status(403).json({ error: 'The built-in admin account cannot be deleted' });

    try {
        const user = await dbGet(`SELECT username FROM users WHERE username = ?`, [username]);
        if (!user) return res.status(404).json({ error: `User "${username}" not found` });

        await dbRun(`DELETE FROM users WHERE username = ?`, [username]);
        await addAudit(req.user, 'User Management', `Deleted user: ${username}`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
});

// ── LOE Database ──────────────────────────────────────────────────────────────
app.get('/api/db', async (_req, res) => {
    try {
        const row = await dbGet(`SELECT data FROM store WHERE id = 1`);
        res.json(JSON.parse(row.data));
    } catch (e) { res.status(500).json({ error: 'Database read failed' }); }
});

app.put('/api/db', requireAuth, async (req, res) => {
    const dbData = req.body;
    if (!dbData || !dbData.versions || !Array.isArray(dbData.versions)) {
        return res.status(400).json({ error: 'Invalid database structure' });
    }

    try {
        await dbRun(`UPDATE store SET data = ? WHERE id = 1`, [JSON.stringify(dbData)]);
        await addAudit(req.user, 'DB Save', 'LOE database saved to server');
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Database write failed' }); }
});

// ── Audit log ─────────────────────────────────────────────────────────────────
app.get('/api/audit', requireAuth, async (_req, res) => {
    try {
        const rows = await dbAll(`SELECT time, user, action, details FROM audit ORDER BY id DESC LIMIT 1000`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/audit', requireAuth, async (req, res) => {
    const { action, details } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action is required' });
    await addAudit(req.user, action, details || '');
    res.json({ ok: true });
});

app.delete('/api/audit', requireAuth, async (req, res) => {
    try {
        await dbRun(`DELETE FROM audit`);
        await addAudit(req.user, 'Audit', 'Audit log cleared by admin');
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
});

// ── LOE Management (Save, Version, Finalize) ──────────────────────────────────
app.get('/api/loes', async (req, res) => {
    try {
        const rows = await dbAll(`SELECT id, customer, project, version, created_at, is_final, public_link FROM saved_loes ORDER BY customer ASC, project ASC, version DESC`);
        res.json(rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/loes/:id', async (req, res) => {
    try {
        const row = await dbGet(`SELECT * FROM saved_loes WHERE id = ?`, [req.params.id]);
        if (!row) return res.status(404).json({error: 'Not found'});
        
        // Write Open action to audit log
        await addAudit(getOptionalUser(req), 'Open LOE', `Opened LOE: ${row.customer} - ${row.project} (v${row.version})`);
        
        res.json(row);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/loes', async (req, res) => {
    const { customer, project, data } = req.body;
    if (!customer || !project || !data) return res.status(400).json({error: 'Missing fields'});
    
    try {
        const lastVer = await dbGet(`SELECT MAX(version) as v FROM saved_loes WHERE customer = ? AND project = ?`, [customer, project]);
        const nextVer = (lastVer && lastVer.v ? lastVer.v : 0) + 1;
        const time = new Date().toISOString();
        
        const result = await dbRun(`INSERT INTO saved_loes (customer, project, version, created_at, data) VALUES (?, ?, ?, ?, ?)`, 
            [customer, project, nextVer, time, data]);
            
        // Write Save action to audit log
        await addAudit(getOptionalUser(req), 'Save LOE', `Saved LOE: ${customer} - ${project} (v${nextVer})`);
        
        res.json({ ok: true, id: result.lastID, version: nextVer });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/loes/:id/finalize', async (req, res) => {
    try {
        const row = await dbGet(`SELECT * FROM saved_loes WHERE id = ?`, [req.params.id]);
        if (!row) return res.status(404).json({error: 'Not found'});
        
        const fileId = crypto.randomBytes(16).toString('hex');
        const filename = `${fileId}.html`;
        const filepath = path.join(PUBLIC_LOE_DIR, filename);
        
        // Generate a static HTML representation of the LOE
        const payload = JSON.parse(row.data);
        const selectedTasks = payload.selectedTasks || {};
        const taskMultipliers = payload.taskMultipliers || {};
        const taskNoteToggles = payload.taskNoteToggles || {};
        const customNotes = payload.customNotes || {};
        const riskFactor = payload.riskFactor || 1;

        let htmlTable = `<table><thead><tr><th>Category > Product</th><th>Task</th><th>Days</th><th>Notes</th></tr></thead><tbody>`;
        let grandTotal = 0;
        let grouped = {};
        for (const [key, task] of Object.entries(selectedTasks)) {
            const group = `${task.category} > ${task.product}`;
            if (!grouped[group]) grouped[group] = [];
            const mult = task.hasMultiplier ? (taskMultipliers[key] || 1) : 1;
            const eff = task.days * mult * riskFactor;
            grandTotal += eff;
            const notes = taskNoteToggles[key] ? (customNotes[key] !== undefined ? customNotes[key] : task.notes) : (task.notes || '');
            grouped[group].push({ name: task.task, mult: task.hasMultiplier ? mult : null, days: eff, notes: notes });
        }
        
        for (const [group, tasks] of Object.entries(grouped)) {
            htmlTable += `<tr style="background:#e2e8f0; font-weight:bold; color:#000;"><td colspan="4">${group}</td></tr>`;
            tasks.forEach(t => {
                const label = t.mult ? `${t.name} (x${t.mult})` : t.name;
                htmlTable += `<tr><td></td><td>${label}</td><td>${t.days.toFixed(2)}</td><td>${t.notes}</td></tr>`;
            });
        }
        htmlTable += `<tr><td colspan="2" style="text-align:right;font-weight:bold;">TOTAL</td><td colspan="2" style="font-weight:bold;color:#2b6ef6;">${grandTotal.toFixed(2)} Days</td></tr>`;
        htmlTable += `</tbody></table>`;
        const htmlContent = `
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Final LOE - ${row.project}</title>
        <style>body{font-family:sans-serif;padding:40px;color:#222;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#2b6ef6;color:white;}</style>
        </head><body>
        <h2>Final LOE: ${row.customer} - ${row.project} (Version ${row.version})</h2>
        <p>Date Finalized: ${new Date().toLocaleDateString()}</p>
        <hr>
        <p style="margin-top:20px;font-size:12px;color:#666;"><i>Note: Interactive details are locked in the final version. Total estimation factors applied securely via Teknicor server.</i></p>
        </body></html>`;
        
        fs.writeFileSync(filepath, htmlContent);
        const publicUrl = `/public/loes/${filename}`;
        
        await dbRun(`UPDATE saved_loes SET is_final = 1, public_link = ? WHERE id = ?`, [publicUrl, row.id]);
        
        // Write Finalize action to audit log
        await addAudit(getOptionalUser(req), 'Finalize LOE', `Finalized LOE: ${row.customer} - ${row.project} (v${row.version})`);
        res.json({ ok: true, url: publicUrl });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║   LOE Builder Pro v19.0 — SQLite Server Started   ║');
    console.log(`║   http://localhost:${PORT}                           ║`);
    console.log(`║   Data directory: ${path.relative(process.cwd(), DATA_DIR)}                            ║`);
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
});