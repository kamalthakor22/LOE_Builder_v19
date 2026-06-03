// js/auth.js - LOE Builder Pro v19.0 - Server-Side Authentication Layer

const TOKEN_KEY = 'loe_v16_token'; // Kept same token key to preserve active sessions

// ── Token helpers ─────────────────────────────────────────────────────────────
function getToken()  { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
function checkAuth() { return Boolean(getToken()); }

// ── Audit logging → server ────────────────────────────────────────────────────
window.logAudit = async function (action, details) {
    if (!checkAuth()) return;
    try {
        await window.loeApi.post('/audit', { action, details: details || '' });
    } catch (e) {}
};

// ── Load LOE database from server on every page load ─────────────────────────
(async function loadDBFromServer() {
    try {
        const res = await window.loeApi.get('/db');
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('loeDB_v2', JSON.stringify(data));
            window.dispatchEvent(new Event('db_loaded'));
        } else {
            console.warn('[LOE] Could not load DB from server:', res.status);
        }
    } catch (e) {
        console.warn('[LOE] Server unreachable — using cached DB:', e.message);
    }
})();

// ── Push local DB to server (called after admin saves tasks) ──────────────────
window.syncDBToServer = async function () {
    if (!checkAuth()) return;
    const state = JSON.parse(localStorage.getItem('loeDB_v2') || '{}');
    if (!state.versions) return;
    try {
        const res = await window.loeApi.put('/db', state);
        if (res.ok) {
            window.showToast('Database synced to server.');
        } else {
            const err = await res.json().catch(() => ({}));
            window.showToast(`Sync failed: ${err.error || res.status}`);
        }
    } catch (e) {
        window.showToast(`Sync error: ${e.message}`);
    }
};

// ── DOM-ready: auth guards + header UI ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn  = checkAuth();
    const path        = window.location.pathname.toLowerCase();
    
    // BUG FIX: Correctly protect loebuilder.html instead of missing admin.html
    const isProtected = path.includes('loebuilder.html') || path.includes('settings.html');
    const isLogin     = path.includes('login.html');

    if (isProtected && !isLoggedIn) { window.location.replace('login.html'); return; }
    if (isLogin     &&  isLoggedIn) { window.location.replace('loebuilder.html'); return; }

    const authContainer = document.getElementById('headerAuthContainer');
    if (!authContainer) return;

    if (isLoggedIn) {
        const user = localStorage.getItem('loe_logged_user') || 'Admin';
        authContainer.innerHTML = `
            <div class="user-dropdown">
                <button class="header-auth-btn">👤 ${user} ▼</button>
                <div class="user-dropdown-content">
                    <button id="logoutBtnNav">🚪 Logout</button>
                </div>
            </div>`;
        document.getElementById('logoutBtnNav').addEventListener('click', async () => {
            try { await window.loeApi.post('/auth/logout', {}); } catch (e) {}
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('loe_logged_user');
            window.location.replace('login.html');
        });
    } else {
        authContainer.innerHTML = `<a href="login.html" class="header-auth-btn">🔑 Admin Login</a>`;
    }
});

// ── Login form handler ────────────────────────────────────────────────────────
async function handleLogin(event) {
    event.preventDefault();
    const u        = document.getElementById('username').value.trim();
    const p        = document.getElementById('password').value;
    const remember = document.getElementById('rememberMe')?.checked ?? false;
    const loginBtn = document.getElementById('loginBtn');

    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Logging in…'; }

    try {
        const res  = await fetch('/api/auth/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (res.ok) {
            const { token, username } = data;
            if (remember) {
                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem('loe_saved_username', username);
            } else {
                sessionStorage.setItem(TOKEN_KEY, token);
                localStorage.removeItem('loe_saved_username');
            }
            localStorage.setItem('loe_logged_user', username);
            window.location.href = 'loebuilder.html'; // BUG FIX: Redirects to correct dashboard
        } else {
            alert(data.error || 'Login failed. Check your credentials.');
            if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Secure Login'; }
        }
    } catch (e) {
        alert(`Cannot connect to server.\n\nMake sure the Node.js server is running.\n\n(${e.message})`);
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Secure Login'; }
    }
}

function forgotPassword() {
    alert('Please contact your system administrator to reset your password.\n\nAdmin: go to Settings → User Management → Change Password.');
}