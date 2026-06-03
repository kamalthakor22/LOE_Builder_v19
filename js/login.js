// js/login.js - LOE Builder Pro v19.0 - Login Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // Restore saved username if "Remember Me" was previously checked
    const savedUsername = localStorage.getItem('loe_saved_username');
    if (savedUsername) {
        const el = document.getElementById('username');
        const cb = document.getElementById('rememberMe');
        if (el) el.value   = savedUsername;
        if (cb) cb.checked = true;
    }

    // ── Server status badge ───────────────────────────────────────────────────
    const badge = document.getElementById('serverStatusBadge');
    if (badge) {
        fetch('/api/health')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                badge.className = 'server-status online';
                badge.textContent = `● Server online — v${data.version}`;
            })
            .catch(() => {
                badge.className = 'server-status offline';
                badge.textContent = '● Server offline — start with: npm start';
            });
    }
});
