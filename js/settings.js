// js/settings.js - LOE Builder Pro v19.0 - Settings Page Logic
// v16: All user management and audit log operations go through the REST API.

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'loeDB_v2';
    const RISK_KEY    = 'loeRiskConfig';

    // ── DB Import / Export + server sync ─────────────────────────────────────
    window.initDBControls('exportBtn', 'importFile', `loe_db_${window.todayStr()}.json`, (data) => {
        window.syncDBToServer();    // push imported DB to server immediately
        window.showToast('Database imported and synced to server.');
    });

    // ── Risk Multipliers ──────────────────────────────────────────────────────
    function defaultRiskConfig() { return { Low: 1, Medium: 1.2, High: 1.4 }; }
    function getRiskConfig() {
        const raw = localStorage.getItem(RISK_KEY);
        if (raw) { try { const p = JSON.parse(raw); if (p && typeof p.Low === 'number') return p; } catch (e) {} }
        const def = defaultRiskConfig(); localStorage.setItem(RISK_KEY, JSON.stringify(def)); return def;
    }
    const lowInput  = document.getElementById('lowInput');
    const medInput  = document.getElementById('medInput');
    const highInput = document.getElementById('highInput');
    function loadRiskInputs() {
        const cfg = getRiskConfig(); lowInput.value = cfg.Low; medInput.value = cfg.Medium; highInput.value = cfg.High;
    }
    loadRiskInputs();

    document.getElementById('saveRiskBtn').addEventListener('click', () => {
        const l = parseFloat(lowInput.value), m = parseFloat(medInput.value), h = parseFloat(highInput.value);
        if (isNaN(l) || isNaN(m) || isNaN(h) || l <= 0 || m <= 0 || h <= 0) { alert('All risk values must be positive numbers.'); return; }
        localStorage.setItem(RISK_KEY, JSON.stringify({ Low: l, Medium: m, High: h }));
        window.logAudit('Settings', 'Updated Risk Factors');
        window.showToast('Risk settings saved.');
    });
    document.getElementById('resetRiskBtn').addEventListener('click', () => {
        if (confirm('Reset risk factors to defaults (Low:1, Medium:1.2, High:1.4)?')) {
            localStorage.setItem(RISK_KEY, JSON.stringify(defaultRiskConfig())); loadRiskInputs();
            window.showToast('Risk factors reset to defaults.');
        }
    });

    // ── User Management — all via REST API ────────────────────────────────────
    async function renderUsers() {
        const listEl = document.getElementById('usersList');
        listEl.innerHTML = '<div class="muted" style="padding:6px;">Loading…</div>';
        try {
            const res   = await window.loeApi.get('/users');
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
            const users = await res.json(); // array of usernames
            if (!users.length) { listEl.innerHTML = '<div class="muted" style="padding:6px;">No users found.</div>'; return; }
            listEl.innerHTML = `<table style="width:100%;font-size:13px;border-collapse:collapse;">
                ${users.map(u => `<tr>
                    <td style="padding:6px 4px;border-bottom:1px solid var(--line);">👤 <b>${u}</b></td>
                    <td style="text-align:right;border-bottom:1px solid var(--line);">
                        <button class="btn ghost small" onclick="showChangePassword('${u}')">Change Password</button>
                        <button class="btn clear small" onclick="deleteUser('${u}')" ${u==='admin'?'disabled title="Cannot delete admin"':''}>Delete</button>
                    </td>
                </tr>`).join('')}
            </table>`;
        } catch (e) {
            listEl.innerHTML = `<div style="color:#ef4444;padding:8px;font-size:13px;">Error loading users: ${e.message}</div>`;
        }
    }

    window.deleteUser = async function (user) {
        if (user === 'admin') { alert('Cannot delete the default admin account.'); return; }
        if (!confirm(`Delete user "${user}"? This cannot be undone.`)) return;
        try {
            const res = await window.loeApi.delete(`/users/${encodeURIComponent(user)}`);
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
            window.showToast(`User "${user}" deleted.`);
            renderUsers();
        } catch (e) { alert('Error deleting user: ' + e.message); }
    };

    window.showChangePassword = function (user) {
        document.getElementById('changePasswordSection').style.display  = 'block';
        document.getElementById('changeUsernameDisplay').textContent    = user;
        document.getElementById('changeUsername').value                  = user;
        document.getElementById('changeNewPassword').focus();
    };

    document.getElementById('changePassBtn').addEventListener('click', async () => {
        const u    = document.getElementById('changeUsername').value;
        const newP = document.getElementById('changeNewPassword').value.trim();
        if (!newP) { alert('Please enter a new password.'); return; }
        try {
            const res = await window.loeApi.put(`/users/${encodeURIComponent(u)}/password`, { password: newP });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
            document.getElementById('changeNewPassword').value = '';
            document.getElementById('changePasswordSection').style.display = 'none';
            window.showToast(`Password updated for "${u}".`);
        } catch (e) { alert('Error changing password: ' + e.message); }
    });

    document.getElementById('addUserBtn').addEventListener('click', async () => {
        const u = document.getElementById('newUsername').value.trim();
        const p = document.getElementById('newPassword').value.trim();
        if (!u || !p) { alert('Both username and password are required.'); return; }
        try {
            const res = await window.loeApi.post('/users', { username: u, password: p });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value  = '';
            window.showToast(`User "${u}" added.`);
            renderUsers();
        } catch (e) { alert('Error adding user: ' + e.message); }
    });

    renderUsers();

    // ── Audit Log — from server ───────────────────────────────────────────────
    async function renderAuditLog() {
        const tbody = document.getElementById('auditList');
        tbody.innerHTML = '<tr><td colspan="4" class="muted" style="padding:8px;">Loading from server…</td></tr>';
        try {
            const res  = await window.loeApi.get('/audit');
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
            const log  = await res.json();
            tbody.innerHTML = log.length
                ? log.map(l => `<tr><td>${l.time}</td><td><b>${l.user}</b></td><td>${l.action}</td><td>${l.details}</td></tr>`).join('')
                : '<tr><td colspan="4" class="muted" style="padding:8px;">No audit events yet.</td></tr>';
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;padding:8px;">Error loading audit log: ${e.message}</td></tr>`;
        }
    }
    renderAuditLog();

    document.getElementById('refreshAuditBtn').addEventListener('click', renderAuditLog);

    document.getElementById('clearAuditBtn').addEventListener('click', async () => {
        if (!confirm('Clear the entire audit log on the server? This cannot be undone.')) return;
        try {
            const res = await window.loeApi.delete('/audit');
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
            window.showToast('Audit log cleared.');
            renderAuditLog();
        } catch (e) { alert('Error clearing audit log: ' + e.message); }
    });

    // Refresh audit when DB loads (page init)
    window.addEventListener('db_loaded', renderAuditLog);

    // ── Sample Data ───────────────────────────────────────────────────────────
    document.getElementById('sampleBtn').addEventListener('click', async () => {
        if (!confirm('Create sample data? This will overwrite the current database on the server.')) return;
        const sampleDB = {
            versions: [{
                id: 1, name: `v${APP_VERSION}`, timestamp: Date.now(),
                data: {
                    'Infrastructure': {
                        'Networking': [
                            { task: 'Switch Configuration', notes: 'Layer 2/3 config', days: 2,   hasMultiplier: false },
                            { task: 'Firewall Rules',       notes: 'Per zone',         days: 1.5, hasMultiplier: true  }
                        ],
                        'Storage': [
                            { task: 'SAN Zoning', notes: '', days: 1,   hasMultiplier: true  },
                            { task: 'NFS Mount',  notes: '', days: 0.5, hasMultiplier: true  }
                        ]
                    },
                    'Application': {
                        'Web Tier': [
                            { task: 'IIS Installation', notes: '',             days: 0.5, hasMultiplier: false },
                            { task: 'SSL Certificate',  notes: 'Per endpoint', days: 0.5, hasMultiplier: true  }
                        ]
                    }
                }
            }],
            currentVersionId: 1
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleDB));
        await window.syncDBToServer();
        window.logAudit('Settings', 'Sample data created');
        window.showToast('Sample data created and synced to server.');
    });

    document.getElementById('clearBtn').addEventListener('click', async () => {
        if (!confirm('Clear the local DB cache? The server copy is preserved. Reload the page to re-fetch from server.')) return;
        localStorage.removeItem(STORAGE_KEY);
        window.showToast('Local cache cleared. Reload the page to re-fetch from server.');
    });
});
