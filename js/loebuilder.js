// js/loebuilder.js - LOE Builder Pro v19.0 - Administrator Page Logic
// v19: After every saveState(), pushes the DB to the server via syncDBToServer().

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'loeDB_v2';

    let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!state.versions) {
        state = {
            versions: [{ id: 1, name: `v${APP_VERSION}`, timestamp: Date.now(), data: {} }],
            currentVersionId: 1
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    let currentVersion = state.versions.find(v => v.id === state.currentVersionId);

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        // v18: push to server so all users get the updated DB
        window.syncDBToServer();
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const categorySelect = document.getElementById('categorySelect');
    const productSelect  = document.getElementById('productSelect');
    const taskInput      = document.getElementById('taskInput');
    const notesInput     = document.getElementById('notesInput');
    const daysInput      = document.getElementById('daysInput');
    const hasMultiplier  = document.getElementById('hasMultiplier');
    const saveTaskBtn    = document.getElementById('saveTaskBtn');
    const clearFormBtn   = document.getElementById('clearFormBtn');
    const treeEl         = document.getElementById('tree');

    // ── DB reload ─────────────────────────────────────────────────────────────
    window.addEventListener('db_loaded', () => {
        state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        currentVersion = state.versions.find(v => v.id === state.currentVersionId);
        initCategoryDatalist();
        renderTree();
    });

    // ── DB Import / Export + manual sync button ───────────────────────────────
    window.initDBControls('exportBtn', 'importFile', `loe_v${APP_VERSION}_export_${window.todayStr()}.json`, (data) => {
        state = data;
        currentVersion = state.versions.find(v => v.id === state.currentVersionId);
        initCategoryDatalist();
        renderTree();
        // Auto-sync imported DB to server
        window.syncDBToServer();
    });

    document.getElementById('syncDbBtn').addEventListener('click', () => {
        window.syncDBToServer();
        window.logAudit('DB Sync', 'Manual sync of LOE database to server');
    });

    // ── Datalists ─────────────────────────────────────────────────────────────
    function initCategoryDatalist() {
        const cats = Object.keys(currentVersion.data || {}).sort();
        document.getElementById('categoryList').innerHTML = cats.map(c => `<option value="${c}">`).join('');
    }

    function updateProductDatalist() {
        const selCat = categorySelect.value.trim();
        let prods = [];
        if (selCat && currentVersion.data[selCat]) {
            prods = Object.keys(currentVersion.data[selCat]).sort();
        }
        document.getElementById('productList').innerHTML = prods.map(p => `<option value="${p}">`).join('');
    }

    categorySelect.addEventListener('change', () => {
        const val = categorySelect.value.trim();
        productSelect.disabled = !val;
        updateProductDatalist();
        if (val && currentVersion.data && currentVersion.data[val]) {
            renderTree();
            const details = Array.from(treeEl.querySelectorAll('details'))
                .find(d => d.dataset.key === `cat::${val}`);
            if (details) details.open = true;
        }
    });

    productSelect.addEventListener('change', () => {
        const cat = categorySelect.value.trim();
        const val = productSelect.value.trim();
        if (cat && val && currentVersion.data[cat] && currentVersion.data[cat][val]) {
            renderTree();
            const prodDetails = treeEl.querySelector(`details[data-key="prod::${cat}::${val}"]`);
            if (prodDetails) prodDetails.open = true;
        }
    });

    document.getElementById('clearCategoryBtn').addEventListener('click', () => {
        categorySelect.value = ''; productSelect.value = ''; productSelect.disabled = true;
    });
    document.getElementById('clearProductBtn').addEventListener('click', () => {
        productSelect.value = '';
    });

    // ── Tree render ───────────────────────────────────────────────────────────
    function captureOpenState() {
        const open = new Set();
        treeEl.querySelectorAll('details').forEach(d => { if (d.open) open.add(d.dataset.key); });
        return open;
    }
    function applyOpenState(openSet) {
        treeEl.querySelectorAll('details').forEach(d => { d.open = openSet.has(d.dataset.key); });
    }

    function renderTree() {
        const prevOpen = captureOpenState();
        const data = currentVersion.data || {};
        const cats = Object.keys(data).sort();
        if (!cats.length) {
            treeEl.innerHTML = '<div class="muted">No categories yet. Add one using the form on the left.</div>';
            return;
        }
        let html = '';
        cats.forEach(cat => {
            html += `<details data-key="cat::${cat}">
                <summary style="justify-content:space-between;width:100%;">
                    <div style="display:flex;align-items:center;gap:8px;">📁 <span style="font-size:13px;font-weight:700">${escapeHtml(cat)}</span></div>
                    <button class="delete-btn" style="width:24px;height:24px;margin-right:10px;" onclick="admin_deleteCategory(event,'${escI(cat)}')"></button>
                </summary>`;
            Object.keys(data[cat]).sort().forEach(prod => {
                html += `<details class="product-block" data-key="prod::${cat}::${prod}">
                    <summary>📦 <span style="font-size:12px;font-weight:700">${escapeHtml(prod)}</span></summary>
                    <table class="task-table">
                        <thead><tr><th>Task</th><th>Days</th><th>Multiplier</th><th style="text-align:right;">Actions</th></tr></thead>
                        <tbody>`;
                data[cat][prod].forEach((task, idx) => {
                    html += `<tr>
                        <td style="cursor:pointer;color:var(--accent)" onclick="admin_editTask('${escI(task.task)}','${escI(task.notes||'')}','${escI(cat)}','${escI(prod)}',${idx})">${escapeHtml(task.task)}</td>
                        <td>${task.days}</td>
                        <td>${task.hasMultiplier ? '<span class="muted">variable</span>' : ''}</td>
                        <td><div class="action-group">
                            <button class="reorder-btn" onclick="admin_moveTaskUp('${escI(cat)}','${escI(prod)}',${idx})">▲</button>
                            <button class="reorder-btn" onclick="admin_moveTaskDown('${escI(cat)}','${escI(prod)}',${idx})">▼</button>
                            <button class="delete-btn" onclick="admin_deleteTask('${escI(cat)}','${escI(prod)}',${idx})" title="Delete"></button>
                        </div></td>
                    </tr>`;
                });
                html += `</tbody></table></details>`;
            });
            html += `</details>`;
        });
        treeEl.innerHTML = html;
        if (prevOpen.size) applyOpenState(prevOpen);
        else treeEl.querySelectorAll('details').forEach(d => d.open = false);
    }

    function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function escI(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

    function getMatchedKey(input, existingKeys) {
        const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normInput = normalize(input);
        for (const key of existingKeys) {
            if (normalize(key) === normInput) return key;
        }
        return input;
    }

    let editContext = null;

    window.admin_editTask = function (taskName, notes, cat, prod, idx) {
        categorySelect.value = cat;
        productSelect.disabled = false;
        productSelect.value = prod;
        taskInput.value = taskName;
        notesInput.value = notes;
        const item = currentVersion.data[cat][prod][idx];
        daysInput.value = item.days;
        hasMultiplier.checked = !!item.hasMultiplier;
        editContext = { category: cat, product: prod, index: idx };
        saveTaskBtn.textContent = 'Update Task';
        saveTaskBtn.classList.add('warning');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.admin_deleteCategory = function (e, cat) {
        e.preventDefault(); e.stopPropagation();
        if (!confirm(`Delete the ENTIRE category "${cat}" and all tasks inside?`)) return;
        delete currentVersion.data[cat];
        window.logAudit('Delete Category', `Deleted category: ${cat}`);
        saveState(); initCategoryDatalist(); renderTree();
    };

    window.admin_deleteTask = function (cat, prod, idx) {
        if (!confirm('Delete this task?')) return;
        const taskName = currentVersion.data[cat][prod][idx].task;
        currentVersion.data[cat][prod].splice(idx, 1);
        if (!currentVersion.data[cat][prod].length) delete currentVersion.data[cat][prod];
        if (!Object.keys(currentVersion.data[cat]).length) delete currentVersion.data[cat];
        window.logAudit('Delete Task', `Deleted "${taskName}" from ${cat} > ${prod}`);
        saveState(); renderTree();
    };

    window.admin_moveTaskUp = function (cat, prod, idx) {
        if (idx <= 0) return;
        const os = captureOpenState();
        const arr = currentVersion.data[cat][prod];
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        saveState(); renderTree(); applyOpenState(os);
    };

    window.admin_moveTaskDown = function (cat, prod, idx) {
        const arr = currentVersion.data[cat][prod];
        if (idx >= arr.length - 1) return;
        const os = captureOpenState();
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        saveState(); renderTree(); applyOpenState(os);
    };

    saveTaskBtn.addEventListener('click', () => {
        let cat      = categorySelect.value.trim();
        let prod     = productSelect.value.trim();
        const taskName = taskInput.value.trim();
        const notes    = notesInput.value.trim();
        const days     = parseFloat(daysInput.value);
        const mult     = hasMultiplier.checked;

        if (!cat || !prod || !taskName || isNaN(days) || days <= 0) {
            alert('Please fill in Category, Product, Task and a valid Days value.');
            return;
        }

        cat  = getMatchedKey(cat,  Object.keys(currentVersion.data || {}));
        ensurePath(cat, prod);
        prod = getMatchedKey(prod, Object.keys(currentVersion.data[cat]));

        const payload = { task: taskName, notes, days, hasMultiplier: mult };

        if (editContext && editContext.category === cat && editContext.product === prod) {
            currentVersion.data[cat][prod][editContext.index] = payload;
            window.logAudit('Update Task', `Updated "${taskName}" in ${cat} > ${prod}`);
        } else {
            if (editContext) {
                const old = currentVersion.data[editContext.category][editContext.product];
                old.splice(editContext.index, 1);
                if (!old.length) delete currentVersion.data[editContext.category][editContext.product];
            }
            currentVersion.data[cat][prod].push(payload);
            window.logAudit('Add Task', `Added "${taskName}" to ${cat} > ${prod}`);
        }
        saveState(); initCategoryDatalist(); clearForm(); renderTree();
    });

    function ensurePath(cat, prod) {
        if (!currentVersion.data)         currentVersion.data = {};
        if (!currentVersion.data[cat])    currentVersion.data[cat] = {};
        if (!currentVersion.data[cat][prod]) currentVersion.data[cat][prod] = [];
    }

    clearFormBtn.addEventListener('click', clearForm);
    function clearForm() {
        categorySelect.value = ''; productSelect.value = ''; productSelect.disabled = true;
        taskInput.value = ''; notesInput.value = ''; daysInput.value = '';
        hasMultiplier.checked = false; editContext = null;
        saveTaskBtn.textContent = 'Save Task';
        saveTaskBtn.classList.remove('warning');
    }

    document.getElementById('expandAllBtn').addEventListener('click',   () => treeEl.querySelectorAll('details').forEach(d => d.open = true));
    document.getElementById('collapseAllBtn').addEventListener('click', () => treeEl.querySelectorAll('details').forEach(d => d.open = false));

    window.initKeyboardShortcuts('#tree');
    initCategoryDatalist();
    renderTree();
});
