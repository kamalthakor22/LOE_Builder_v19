'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// LOE Builder Pro v17.0 — One-Time SQLite Migration Script
// ─────────────────────────────────────────────────────────────────────────────
// Run this script once to transfer data from your v16 JSON files into SQLite.

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'loe_database.sqlite');

// JSON paths
const DB_JSON = path.join(DATA_DIR, 'loe_db.json');
const AUDIT_JSON = path.join(DATA_DIR, 'loe_audit.json');
const USERS_JSON = path.join(DATA_DIR, 'loe_users.json');

const db = new sqlite3.Database(DB_FILE);

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) { err ? reject(err) : resolve(this); });
});

async function migrate() {
    console.log('Starting migration to SQLite...\n');

    // 1. Setup Tables
    await dbRun(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, user TEXT, action TEXT, details TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT)`);

    // 2. Migrate LOE Database (loe_db.json)
    if (fs.existsSync(DB_JSON)) {
        const dbData = fs.readFileSync(DB_JSON, 'utf8');
        await dbRun(`DELETE FROM store WHERE id = 1`); // Clear default if it exists
        await dbRun(`INSERT INTO store (id, data) VALUES (1, ?)`, [dbData]);
        console.log('✅ Migrated loe_db.json into "store" table.');
    } else {
        console.log('⚠️ loe_db.json not found, skipping...');
    }

    // 3. Migrate Users (loe_users.json)
    if (fs.existsSync(USERS_JSON)) {
        const usersData = JSON.parse(fs.readFileSync(USERS_JSON, 'utf8'));
        let userCount = 0;
        for (const [username, hash] of Object.entries(usersData)) {
            await dbRun(`INSERT OR REPLACE INTO users (username, password) VALUES (?, ?)`, [username, hash]);
            userCount++;
        }
        console.log(`✅ Migrated ${userCount} users from loe_users.json.`);
    } else {
        console.log('⚠️ loe_users.json not found, skipping...');
    }

    // 4. Migrate Audit Logs (loe_audit.json)
    if (fs.existsSync(AUDIT_JSON)) {
        const auditData = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
        await dbRun(`DELETE FROM audit`); // Clear to prevent duplicates
        
        // Reverse the array so the oldest logs get inserted first and maintain chronological order
        const reversedAudit = auditData.reverse();
        let auditCount = 0;
        for (const log of reversedAudit) {
            await dbRun(`INSERT INTO audit (time, user, action, details) VALUES (?, ?, ?, ?)`, 
                [log.time, log.user, log.action, log.details || '']);
            auditCount++;
        }
        console.log(`✅ Migrated ${auditCount} audit logs from loe_audit.json.`);
    } else {
        console.log('⚠️ loe_audit.json not found, skipping...');
    }

    console.log('\n🚀 Migration complete! You can now safely delete the .json files in the data folder.');
    db.close();
}

migrate().catch(err => console.error('\n❌ Migration failed:', err));