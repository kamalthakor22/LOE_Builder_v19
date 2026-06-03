// js/shared.js - LOE Builder Pro v19.0 - Shared UI Module

const APP_VERSION     = '19.0';
const APP_STORAGE_KEY = 'loeDB_v2';
const TODAY_FORMATTED = (new Date()).toLocaleDateString('en-GB', {day: '2-digit',month: 'short',year: 'numeric'}).replace(',', '');

const CHANGELOG = [
    { v: '19.0', date: TODAY_FORMATTED, notes: 'Added dedicated LOE Search Manager page with filtering. Fixed Theme toggle icon bugs. Re-styled Excel export to professional standard. Empty fresh state generated on load. Enforced auto-saving prior to all text/CSV/Excel exports. Finalized LOEs now render a full HTML view.' },
    { v: '18.0', date: TODAY_FORMATTED, notes: 'Introduced LOE Versioning and saving to database. Added public link generation for finalized LOEs. Upgraded Excel export to native .xlsx with proper styling, fonts, and sizes. Fixed tree collapse bug when adding notes. Updated Theme toggle UI with dynamic Sun/Moon icons. Enforced customer and project validation for exports.' }, 
    { v: '17.0', date: '26 May 2026', notes: 'Migrated to SQLite database backend. Fixed unauthorized access to LOE Builder. Fixed Settings page redirection. Added direct multiplier editing in the active LOE table. Added inline task Notes support (checkbox and text area) that merge into all exports.' },
    { v: '16.0', date: '02 May 2026',  notes: 'Web server edition. Node.js/Express backend serves user management, LOE database, and audit log. REST API with token-based sessions.' },
    { v: '15.0', date: '02 May 2026',  notes: 'Modular architecture. Centralised file-based user management. LOE selections persist across page navigation.' },
    { v: '14.0', date: '02 May 2026',  notes: 'Split-card login layout. DB Import integrated natively into LOE Builder. Auto-DB load with dynamic UI refresh.' },
    { v: '13.0', date: '18 Apr 2026',  notes: 'Fixed Category selection bug. Global Enterprise Header. Settings reordered.' },
    { v: '12.0', date: '17 Apr 2026',  notes: 'Auto-Correct case insensitivity. Delete whole categories. Audit Logging.' },
    { v: '11.0', date: '16 Apr 2026',  notes: 'Output grouping by Category > Product. Change Password. SHA-256 hashed passwords.' },
    { v: '10.0', date: '15 Apr 2026',  notes: 'User Management panel. Search filters. Excel Export with project details.' },
    { v: '9.0',  date: '14 Apr 2026',  notes: 'Global CSS. Auth protection for Admin and Settings. UI standardised.' },
    { v: '8.0',  date: '12 Apr 2026',  notes: 'Theme consistency and UI polish.' },
    { v: '7.0',  date: '11 Apr 2026',  notes: 'Dark / Light theme toggle with localStorage persistence.' },
    { v: '6.0',  date: '11 Apr 2026',  notes: 'Sidebar with hamburger toggle, logo, navigation links.' },
    { v: '1.0',  date: '09 Apr 2026',  notes: 'Initial working prototype.' }
];

// ─── SYNCHRONOUS UI INJECTION ─────────────────────────────────────────────────
(function injectSharedUI() {
    if (localStorage.getItem('loe_theme') === 'dark') document.body.classList.add('dark');

    document.body.insertAdjacentHTML('afterbegin', `
        <div class="global-header" id="globalHeader">
            <div>LOE Builder Pro <span class="title-accent">Enterprise Estimation Engine</span></div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span id="headerVersion" title="Click for what's new" style="cursor:pointer;text-decoration:underline dotted;"
                      onclick="document.getElementById('openChangeLogSidebar')&&document.getElementById('openChangeLogSidebar').click()">
                    v${APP_VERSION}
                </span>
                <div id="headerAuthContainer"></div>
            </div>
        </div>`);

    document.body.insertAdjacentHTML('afterbegin', '<div id="toast"></div>');

	const sidebarHTML = `
        <div id="app-sidebar" class="sidebar-open" role="navigation">
            <div class="sb-top">
                <button id="sbToggle" class="sb-toggle" title="Toggle Sidebar">☰</button>
                <div class="sb-logo" title="LOE Builder Pro">
                    <img id="sidebarLogo" src="images/teknicor-logo.svg" alt="Teknicor Logo">
                </div>
            </div>
            <nav class="sb-nav" id="sbNav">
                <a href="loebuilder.html"      class="sb-item" data-label="LOE Builder"><span class="icon">📋</span><span class="label">LOE Builder</span></a>
                <a href="loegenerator.html" class="sb-item" data-label="LOE Generator"><span class="icon">🧮</span><span class="label">LOE Generator</span></a>
                <a href="loemanager.html"   class="sb-item" data-label="LOE Manager"><span class="icon">📂</span><span class="label">LOE Manager</span></a>
                <a href="settings.html"   class="sb-item" data-label="Settings"><span class="icon">⚙️</span><span class="label">Settings</span></a>
            </nav>
            <div class="sidebar-sep"></div>
            <div class="sb-bottom">
                <button id="themeToggle"          class="sb-item" data-label="Toggle Theme"></button>
                <button id="openChangeLogSidebar" class="sb-item" data-label="Change Log"><span class="icon">📝</span><span class="label">Change Log</span></button>
                <button id="openAboutSidebar"     class="sb-item" data-label="About"><span class="icon">ℹ️</span><span class="label">About</span></button>
            </div>
        </div>`;
    const mainEl = document.querySelector('.main');
    if (mainEl) mainEl.insertAdjacentHTML('beforebegin', sidebarHTML);
    else document.body.insertAdjacentHTML('beforeend', sidebarHTML);

    document.body.insertAdjacentHTML('beforeend', '<button id="topBtn" title="Scroll to Top">&#9650; Top</button>');

    document.body.insertAdjacentHTML('beforeend', `
        <div id="changeLogModal" class="modal">
            <div class="modal-box">
                <button id="closeChangeLogX" class="modal-close-btn">&times;</button>	 
                <h2>Change Log — LOE Builder Pro</h2>
                <div id="changeLogContent" style="font-size:13px;max-height:55vh;overflow-y:auto;"></div>
                <div style="text-align:right;margin-top:12px">
                    <button id="closeChangeLog" class="btn ghost">Close</button>
                </div>
            </div>
        </div>
        <div id="aboutModal" class="modal">
            <div class="modal-box">
                <button id="closeAboutX" class="modal-close-btn">&times;</button>
                <h2>About LOE Builder Pro</h2>
                <div id="aboutContent" style="font-size:13px;line-height:1.7;max-height:60vh;overflow-y:auto;"></div>
                <div style="text-align:right;margin-top:12px">
                    <button id="closeAbout" class="btn ghost">Close</button>
                </div>
            </div>
        </div>`);
})();


// ─── API HELPER ───────────────────────────────────────────────────────────────
window.loeApi = (function () {
    const TOKEN_KEY = 'loe_v16_token';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
    }

    async function call(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const opts = { method, headers };
        if (body !== undefined) opts.body = JSON.stringify(body);

        let res;
        try { res = await fetch(`/api${path}`, opts); }
        catch (e) {
            throw new Error(`Network error — cannot reach server. Is the server running? (${e.message})`);
        }

        if (res.status === 401 && !window.location.pathname.endsWith('login.html')) {
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            window.location.replace('login.html');
            throw new Error('Session expired');
        }
        return res;
    }

    return {
        getToken,
        get:    (path)        => call('GET',    path),
        post:   (path, body)  => call('POST',   path, body),
        put:    (path, body)  => call('PUT',    path, body),
        delete: (path)        => call('DELETE', path)
    };
})();

// ─── GLOBAL HELPERS ───────────────────────────────────────────────────────────
window.showToast = function (msg, duration) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration || 8000);
};

window.todayStr = function () {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

window.loe_exportDB = function (defaultFilename) {
    const filename = prompt('Enter filename for export:', defaultFilename || `loe_export_${window.todayStr()}.json`);
    if (!filename) return;
    const state = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) || '{}');
    const blob  = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = filename.endsWith('.json') ? filename : filename + '.json';
    a.click();
    window.showToast(`Exported: ${a.download}`);
};

window.loe_importDB = function (file, onSuccess) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data) throw new Error('Empty file');
            localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
            window.showToast(`Imported: ${file.name} — syncing to server…`);
            if (typeof onSuccess === 'function') onSuccess(data);
        } catch (e) { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
};

window.initDBControls = function (exportBtnId, importInputId, defaultFilename, onImport) {
    const exportBtn   = document.getElementById(exportBtnId);
    const importInput = document.getElementById(importInputId);
    if (exportBtn)   exportBtn.addEventListener('click', () => window.loe_exportDB(defaultFilename));
    if (importInput) importInput.addEventListener('change', ev => {
        window.loe_importDB(ev.target.files[0], onImport);
        ev.target.value = '';
    });
};

window.initDBControls = function (exportBtnId, importInputId, defaultFilename, onImport) {
    const importInput = document.getElementById(importInputId);
    if (importInput) importInput.addEventListener('change', ev => {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
                window.showToast(`Imported database successfully.`);
                if (typeof onImport === 'function') onImport(data);
            } catch (err) { alert('Invalid JSON file.'); }
        };
        reader.readAsText(file);
        ev.target.value = '';
    });
};

window.initKeyboardShortcuts = function (treeSelector) {
    document.addEventListener('keydown', ev => {
        if (!ev.ctrlKey || !ev.shiftKey) return;
        const key = ev.key.toLowerCase();
        if (key === 'e') { document.querySelectorAll(`${treeSelector} details`).forEach(d => d.open = true);  ev.preventDefault(); }
        if (key === 'c') { document.querySelectorAll(`${treeSelector} details`).forEach(d => d.open = false); ev.preventDefault(); }
        if (key === 't') { window.scrollTo({ top: 0, behavior: 'smooth' });                                   ev.preventDefault(); }
    });
};


// ─── DOM-READY BEHAVIOUR ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const footer = document.getElementById('appFooter');
    if (footer) footer.textContent = `LOE Builder Pro v${APP_VERSION} — Teknicor Corporation`;

    const sb          = document.getElementById('app-sidebar');
    const sbToggle    = document.getElementById('sbToggle');
    const sidebarLogo = document.getElementById('sidebarLogo');
    const sbItems     = document.querySelectorAll('.sb-item');
    const headerLogoCont = document.getElementById('headerLogoContainer');

	// ── Theme ─────────────────────────────────────────────────────────────────
    const themeToggle = document.getElementById('themeToggle');
    
    function updateThemeIcon() {
        const isDark = document.body.classList.contains('dark');
        if (themeToggle) {
            themeToggle.innerHTML = isDark 
                ? '<span class="icon">☀️</span><span class="label">Light Theme</span>' 
                : '<span class="icon">🌙</span><span class="label">Dark Theme</span>';
        }
    }
    
    // Call immediately to set the correct icon on page load
    updateThemeIcon();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const next = document.body.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('loe_theme', next);
            if (next === 'dark') document.body.classList.add('dark');
            else document.body.classList.remove('dark');
            updateThemeIcon(); // Swap the icon dynamically on click
        });
    }
	
    function updateTooltips() {
        const closed = sb.classList.contains('sidebar-closed');
        sbItems.forEach(item => {
            const lbl = item.dataset.label;
            if (!lbl) return;
            if (closed) item.setAttribute('title', lbl);
            else item.removeAttribute('title');
        });
    }
    function moveLogoToHeader() {
        if (!sidebarLogo || !headerLogoCont) return;
        headerLogoCont.innerHTML = '';
        const img = sidebarLogo.cloneNode(true);
        img.style.maxWidth = '120px';
        headerLogoCont.appendChild(img);
        headerLogoCont.setAttribute('aria-hidden', 'false');
    }
    function moveLogoToSidebar() {
        if (!headerLogoCont) return;
        headerLogoCont.innerHTML = '';
        headerLogoCont.setAttribute('aria-hidden', 'true');
    }

    sbToggle.addEventListener('click', () => {
        sb.classList.toggle('sidebar-closed');
        const closed = sb.classList.contains('sidebar-closed');
        localStorage.setItem('loe_sidebar_closed', closed ? '1' : '0');
        if (closed) moveLogoToHeader(); else moveLogoToSidebar();
        updateTooltips();
    });
    if (localStorage.getItem('loe_sidebar_closed') === '1') {
        sb.classList.add('sidebar-closed');
        moveLogoToHeader();
    }
    updateTooltips();

	themeToggle.addEventListener('click', () => {
        const next = document.body.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('loe_theme', next);
        if (next === 'dark') document.body.classList.add('dark');
        else document.body.classList.remove('dark');
        updateThemeIcon();
    });
	
    const pathname = window.location.pathname.toLowerCase();
    document.querySelectorAll('.sb-item[href]').forEach(item => {
        if (pathname.endsWith(item.getAttribute('href').toLowerCase())) item.classList.add('active');
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
        const next = document.body.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('loe_theme', next);
        if (next === 'dark') document.body.classList.add('dark');
        else document.body.classList.remove('dark');
    });

    document.getElementById('openChangeLogSidebar').addEventListener('click', () => {
        document.getElementById('changeLogContent').innerHTML = CHANGELOG.map(c =>
            `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line);">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="background:var(--accent);color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">v${c.v}</span>
                    <span class="muted" style="font-size:12px;">${c.date}</span>
                </div>
                <div style="font-size:13px;">${c.notes}</div>
            </div>`
        ).join('');
        document.getElementById('changeLogModal').style.display = 'flex';
    });
    document.getElementById('closeChangeLog').addEventListener('click', () => {
        document.getElementById('changeLogModal').style.display = 'none';
    });
	document.getElementById('closeChangeLogX').addEventListener('click', () => {
		document.getElementById('changeLogModal').style.display = 'none';
	});

    document.getElementById('openAboutSidebar').addEventListener('click', () => {
        document.getElementById('aboutContent').innerHTML = `
            <div style="text-align:center;margin-bottom:16px;">
                <span style="font-size:48px;">🧮</span><br>
                <b style="font-size:18px;">LOE Builder Pro</b><br>
                <span style="background:var(--accent);color:#fff;padding:3px 12px;border-radius:12px;font-size:13px;font-weight:700;display:inline-block;margin-top:6px;">Version ${APP_VERSION} — SQLite Server Edition</span>
            </div>
            <b>Architecture (v19.0)</b>
            <ul style="margin:6px 0 12px 0;padding-left:18px;line-height:1.8;">
                <li><b>server/server.js</b> — Node.js/Express REST API + static file serving</li>
                <li><b>server/data/loe_database.sqlite</b> — Consolidated SQLite Database replacing all JSON files</li>
                <li><b>js/shared.js</b> — Global UI, sidebar, modals, API helper (window.loeApi)</li>
                <li><b>js/auth.js</b> — Token-based auth, server login/logout, DB load</li>
                <li><b>js/loegenerator.js</b> — Interactive Generation with real-time Notes and Multipliers</li>
				<li>Database LOE Versioning & Management</li>
                <li>Public HTML finalize exports</li>
                <li>Native .xlsx generation via ExcelJS (styled cells & fonts)</li>
                <li>Preserved hierarchy state when toggling task notes</li>
                <li>Mandatory validation for Customer & Project inputs</li>
				</ul>
            <b>Key Features</b>
            <ul style="margin:6px 0;padding-left:18px;line-height:1.8;">
            <ul style="margin:6px 0 12px 0;padding-left:18px;line-height:1.8;">
                <li>Search functionality in dedicated LOE Manager</li>
                <li>Fresh empty state enforced on initial load</li>
                <li>Finalized LOE public HTML rendering</li>
                <li>Professional Excel formatting layout</li>
                <li>Version-tracking automatically enforced on export</li>
            </ul>
            <p class="muted" style="font-size:12px;text-align:center;margin-bottom:0;">Teknicor Corporation — Built ${new Date().getMonth().toLocaleString()} ${new Date().getFullYear()}</p>`;
        document.getElementById('aboutModal').style.display = 'flex';
    });
    document.getElementById('closeAbout').addEventListener('click', () => {
        document.getElementById('aboutModal').style.display = 'none';
    });

    document.getElementById('closeAboutX').addEventListener('click', () => {
 	    document.getElementById('aboutModal').style.display = 'none';
	});
   
    const topBtn = document.getElementById('topBtn');
    window.addEventListener('scroll', () => { topBtn.style.display = window.scrollY > 300 ? 'block' : 'none'; });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});