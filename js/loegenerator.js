// js/loegenerator.js - LOE Builder Pro v19.0 - LOE Builder Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY         = 'loeDB_v2';
    const RISK_KEY            = 'loeRiskConfig';
    const PERSIST_TASKS       = 'loe_selected_tasks';
    const PERSIST_MULTS       = 'loe_task_multipliers';
    const PERSIST_PROJ        = 'loe_project_details';
    const PERSIST_NOTETOGGLES = 'loe_note_toggles'; // Tracking the checkbox
    const PERSIST_CUSTOMNOTES = 'loe_custom_notes'; // Tracking typed text
	let currentLoadedLoeId    = null;
    let currentLoadedVersion = 0;
	
    function defaultRiskConfig() { return { Low: 1, Medium: 1.2, High: 1.4 }; }
 
	function getRiskConfig() {
        const raw = localStorage.getItem(RISK_KEY);
        if (raw) { try { const p = JSON.parse(raw); if (p && typeof p.Low === 'number') return p; } catch (e) {} }
        const def = defaultRiskConfig();
        localStorage.setItem(RISK_KEY, JSON.stringify(def));
        return def;
    }

    let riskConfig     = getRiskConfig();
    let state          = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    let currentVersion = state.versions ? state.versions.find(v => v.id === state.currentVersionId) : null;

    const treeEl      = document.getElementById('tree');
    const riskSelect  = document.getElementById('riskSelect');
    const searchInput = document.getElementById('searchInput');

    let selectedTasks   = {};
    let taskMultipliers = {};
    let taskNoteToggles = {};
    let customNotes     = {};

    // ── Persist selections across navigation ──────────────────────────────────
    function saveSelections() {
        localStorage.setItem(PERSIST_TASKS, JSON.stringify(selectedTasks));
        localStorage.setItem(PERSIST_MULTS, JSON.stringify(taskMultipliers));
        localStorage.setItem(PERSIST_NOTETOGGLES, JSON.stringify(taskNoteToggles));
        localStorage.setItem(PERSIST_CUSTOMNOTES, JSON.stringify(customNotes));
        const proj = {
            customer: document.getElementById('customerName')?.value || '',
            project:  document.getElementById('projectName')?.value  || ''
        };
        localStorage.setItem(PERSIST_PROJ, JSON.stringify(proj));
    }
    
    function loadSelections() {
        try { selectedTasks   = JSON.parse(localStorage.getItem(PERSIST_TASKS) || '{}'); } catch (e) { selectedTasks = {}; }
        try { taskMultipliers = JSON.parse(localStorage.getItem(PERSIST_MULTS) || '{}'); } catch (e) { taskMultipliers = {}; }
        try { taskNoteToggles = JSON.parse(localStorage.getItem(PERSIST_NOTETOGGLES) || '{}'); } catch (e) { taskNoteToggles = {}; }
        try { customNotes     = JSON.parse(localStorage.getItem(PERSIST_CUSTOMNOTES) || '{}'); } catch (e) { customNotes = {}; }
        try {
            const proj = JSON.parse(localStorage.getItem(PERSIST_PROJ) || '{}');
            if (proj.customer) document.getElementById('customerName').value = proj.customer;
            if (proj.project)  document.getElementById('projectName').value  = proj.project;
        } catch (e) {}
    }
    window.addEventListener('beforeunload', saveSelections);

    window.addEventListener('db_loaded', () => {
        state          = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        currentVersion = state.versions ? state.versions.find(v => v.id === state.currentVersionId) : null;
        init();
    });

    window.initDBControls('exportJsonBtn', 'importFileLoe', `loe_db_${window.todayStr()}.json`, (data) => {
        state          = data;
        currentVersion = state.versions ? state.versions.find(v => v.id === state.currentVersionId) : null;
        window.syncDBToServer();
        init();
    });

    function matchFilter(c, p, t, filter) {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return c.toLowerCase().includes(f) || p.toLowerCase().includes(f) || (t && t.toLowerCase().includes(f));
    }
    function escJs(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

    // ── Checkbox product list ─────────────────────────────────────────────────
    function renderProductCheckboxes(filter = '') {
        const container = document.getElementById('productCheckboxList');
        if (!container) return;
        container.innerHTML = '';
        if (!currentVersion || !currentVersion.data) return;
        const options = [];
        for (const c in currentVersion.data) {
            for (const p in currentVersion.data[c]) {
                if (matchFilter(c, p, null, filter)) options.push({ category: c, product: p });
            }
        }
        options.sort((a, b) => (a.category + a.product).localeCompare(b.category + b.product));
        if (!options.length) {
            container.innerHTML = '<div class="muted" style="padding:8px;">No products match your filter.</div>';
            return;
        }
        options.forEach(op => {
            const val      = `${op.category}|||${op.product}`;
            const isActive = Object.values(selectedTasks).some(t => t.category === op.category && t.product === op.product);
            const label    = document.createElement('label');
            label.className = 'product-checkbox-item' + (isActive ? ' active' : '');
            label.innerHTML = `
                <input type="checkbox" class="product-cb" value="${escJs(val)}" ${isActive ? 'checked' : ''}>
                <span class="product-cb-cat">${op.category}</span>
                <span class="product-cb-prod">${op.product}</span>`;
            label.querySelector('input').addEventListener('change', (ev) => {
                onProductCheckboxChange(ev.target.value, ev.target.checked, label);
            });
            container.appendChild(label);
        });
    }

    function onProductCheckboxChange(val, checked, labelEl) {
        const [c, p] = val.split('|||');
        if (checked) {
            if (currentVersion.data[c] && currentVersion.data[c][p]) {
                currentVersion.data[c][p].forEach(item => {
                    const key = `${c} > ${p} > ${item.task}`;
                    selectedTasks[key] = { category: c, product: p, task: item.task, notes: item.notes || '', days: item.days, hasMultiplier: !!item.hasMultiplier };
                    if (item.hasMultiplier && taskMultipliers[key] == null) taskMultipliers[key] = 1;
                });
            }
            if (labelEl) labelEl.classList.add('active');
        } else {
            for (const k of Object.keys(selectedTasks)) {
                if (selectedTasks[k].category === c && selectedTasks[k].product === p) {
                    delete selectedTasks[k]; delete taskMultipliers[k]; delete taskNoteToggles[k]; delete customNotes[k];
                }
            }
            if (labelEl) labelEl.classList.remove('active');
        }
        renderTree(searchInput.value.trim());
        if (checked) {
            const catEl  = treeEl.querySelector(`details[data-key="cat::${c}"]`);
            const prodEl = treeEl.querySelector(`details[data-key="prod::${c}::${p}"]`);
            if (catEl)  catEl.open  = true;
            if (prodEl) prodEl.open = true;
        }
        renderTable();
        saveSelections();
    }

    // ── Task Management Actions ────────────────────────────────────────────────
    window.toggleTaskSelection = function (c, p, t, notes, d, hasMult, checked) {
        const key = `${c} > ${p} > ${t}`;
        if (checked) {
            selectedTasks[key] = { category: c, product: p, task: t, notes, days: d, hasMultiplier: hasMult };
            if (hasMult && taskMultipliers[key] == null) taskMultipliers[key] = 1;
        } else {
            delete selectedTasks[key]; delete taskMultipliers[key]; delete taskNoteToggles[key]; delete customNotes[key];
        }
        renderTable();
        renderProductCheckboxes(searchInput.value.trim());
        saveSelections();
    };

    window.toggleTaskNote = function (c, p, t, notes, d, hasMult, checked) {
        const key = `${c} > ${p} > ${t}`;
        if (checked) {
            taskNoteToggles[key] = true;
            if (!selectedTasks[key]) {
                toggleTaskSelection(c, p, t, notes, d, hasMult, true);
            }
        } else {
            delete taskNoteToggles[key];
        }
        renderTree(searchInput.value.trim());
        renderTable();
        saveSelections();
    };

    window.updateCustomNote = function (key, val) {
        customNotes[key] = val;
        saveSelections();
    };

    window.updateTaskMultiplier = function (c, p, t, val) {
        const key = `${c} > ${p} > ${t}`;
        const num = parseFloat(val);
        taskMultipliers[key] = (!isNaN(num) && num > 0) ? num : 1;
        
        const hierarchyInput = document.getElementById(`mult_hierarchy_${escJs(key)}`);
        if (hierarchyInput) hierarchyInput.value = taskMultipliers[key];
        
        renderTable(); saveSelections();
    };

    window.deleteSelectedTask = function (key) {
        delete selectedTasks[key]; delete taskMultipliers[key]; delete taskNoteToggles[key]; delete customNotes[key];
        renderTree(searchInput.value.trim());
        renderProductCheckboxes(searchInput.value.trim());
        renderTable(); saveSelections();
    };

	// ── Tree Rendering with State Preservation ────────────────────────────────
    function captureOpenState() {
        const open = new Set();
        treeEl.querySelectorAll('details').forEach(d => { if (d.open) open.add(d.dataset.key); });
        return open;
    }

    function renderTree(filter = '') {
		const prevOpen = captureOpenState();
        const data = currentVersion ? (currentVersion.data || {}) : {};
        const categories = Object.keys(data).sort();
		
        if (!categories.length) {
            treeEl.innerHTML = '<div class="muted">No data loaded. Add tasks in Admin or import a database.</div>';
            return;
        }
        let html = '';
        categories.forEach(c => {
            let hasMatchInCat = false, catHtml = '';
            Object.keys(data[c]).sort().forEach(p => {
                let hasMatchInProd = false;
                let prodHtml = `<table class="task-table"><thead><tr><th>Task</th><th>Days</th><th>Mult.</th><th style="text-align:center">+ Note</th><th></th></tr></thead><tbody>`;
                data[c][p].forEach(item => {
                    if (!matchFilter(c, p, item.task, filter)) return;
                    hasMatchInCat = hasMatchInProd = true;
                    const key     = `${c} > ${p} > ${item.task}`;
                    const checked = selectedTasks[key] ? 'checked' : '';
                    const noteChecked = taskNoteToggles[key] ? 'checked' : '';
                    
                    const multCell = item.hasMultiplier
                        ? `<input id="mult_hierarchy_${escJs(key)}" class="multiplier-input" type="number" min="1" step="1" value="${taskMultipliers[key] ?? 1}" onchange="updateTaskMultiplier('${escJs(c)}','${escJs(p)}','${escJs(item.task)}',this.value)">`
                        : '';

                    prodHtml += `<tr>
                        <td><label style="display:flex;align-items:center;gap:8px">
                            <input type="checkbox" ${checked} onchange="toggleTaskSelection('${escJs(c)}','${escJs(p)}','${escJs(item.task)}','${escJs(item.notes||'')}',${item.days},${!!item.hasMultiplier},this.checked)">
                            ${item.task}
                        </label></td>
                        <td>${item.days}</td>
                        <td>${multCell}</td>
                        <td style="text-align:center"><input type="checkbox" title="Add custom note" ${noteChecked} onchange="toggleTaskNote('${escJs(c)}','${escJs(p)}','${escJs(item.task)}','${escJs(item.notes||'')}',${item.days},${!!item.hasMultiplier},this.checked)"></td>
                        <td><span class="muted" style="font-size:11px;">${item.hasMultiplier ? 'var' : ''}</span></td>
                    </tr>`;
                });
                prodHtml += `</tbody></table>`;
                if (hasMatchInProd) catHtml += `<details class="product-block" data-key="prod::${c}::${p}" ${filter ? 'open' : ''}><summary>📦 ${p}</summary>${prodHtml}</details>`;
            });
            if (hasMatchInCat) html += `<details data-key="cat::${c}" ${filter ? 'open' : ''}><summary>📁 ${c}</summary>${catHtml}</details>`;
        });
        treeEl.innerHTML = html || `<div class="muted">No matches for "${filter}".</div>`;
		
		// Restore open state
        treeEl.querySelectorAll('details').forEach(d => { 
            if (filter !== '' || prevOpen.has(d.dataset.key)) d.open = true; 
        });
    }

    function populateRiskDropdown() {
        riskSelect.innerHTML = '';
        Object.keys(riskConfig).forEach(k => {
            const o = document.createElement('option');
            o.value = k; o.textContent = k; riskSelect.appendChild(o);
        });
        if (riskSelect.querySelector("option[value='Low']")) riskSelect.value = 'Low';
        else riskSelect.value = riskSelect.options[0]?.value || '';
        updateRiskInfo();
    }
    function updateRiskInfo() {
        document.getElementById('riskInfo').textContent = `Factor: ${riskConfig[riskSelect.value] ?? 1}`;
    }
    riskSelect.addEventListener('change', () => { updateRiskInfo(); renderTable(); });

    // ── LOE Table ─────────────────────────────────────────────────────────────
    function renderTable() {
        const container  = document.getElementById('loeTableContainer');
        const entries    = Object.values(selectedTasks);
        if (!entries.length) {
            container.innerHTML = "<p class='muted'>No tasks selected. Check products in the list on the left, or check individual tasks in the hierarchy below.</p>";
            return;
        }
        const riskFactor = riskConfig[riskSelect.value] ?? 1;
        let total = 0;
        
        const rows = entries.map(e => {
            const key  = `${e.category} > ${e.product} > ${e.task}`;
            const mult = e.hasMultiplier ? (taskMultipliers[key] ?? 1) : 1;
            const eff  = e.days * mult * riskFactor;
            total += eff;

            const multDisplay = e.hasMultiplier 
                ? `<input class="multiplier-input" type="number" min="1" step="1" value="${mult}" style="width:60px; text-align:right;" onchange="updateTaskMultiplier('${escJs(e.category)}','${escJs(e.product)}','${escJs(e.task)}',this.value)">` 
                : '';

            const mainRow = `<tr>
                <td>${e.category}</td><td>${e.product}</td><td>${e.task}</td>
                <td style="text-align:right">${e.days.toFixed(2)}</td>
                <td style="text-align:right">${multDisplay}</td>
                <td style="text-align:right;font-weight:600;">${eff.toFixed(2)}</td>
                <td style="text-align:center">
                    <button class="delete-btn" style="width:24px;height:24px;" onclick="deleteSelectedTask('${escJs(key)}')"></button>
                </td>
            </tr>`;

            let noteRow = '';
            if (taskNoteToggles[key]) {
                const currentNote = customNotes[key] !== undefined ? customNotes[key] : (e.notes || '');
                noteRow = `<tr>
                    <td colspan="6" style="padding: 4px 8px 12px 24px; background: var(--sidebar-bg); border-bottom: 1px solid var(--line);">
                        <textarea style="width: 100%; border: 1px solid var(--line); border-radius: 4px; padding: 6px; font-family: inherit; font-size: 13px;" rows="2" placeholder="Add custom notes..." onchange="updateCustomNote('${escJs(key)}', this.value)">${currentNote}</textarea>
                    </td>
                    <td style="border-bottom: 1px solid var(--line); background: var(--sidebar-bg);"></td>
                </tr>`;
            }
            return mainRow + noteRow;
        }).join('');

        container.innerHTML = `
            <table class="task-table" style="width:100%;border-collapse:collapse">
                <thead><tr><th>Category</th><th>Product</th><th>Task</th><th style="text-align:right">Base</th><th style="text-align:right">Mult.</th><th style="text-align:right">Days</th><th style="width:40px;text-align:center">X</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr>
                    <td colspan="5" style="text-align:right;font-weight:700;padding-top:10px;">TOTAL</td>
                    <td style="text-align:right;font-weight:700;color:var(--accent);padding-top:10px;">${total.toFixed(2)}</td>
                    <td></td>
                </tr></tfoot>
            </table>`;
    }

	function checkRequiredFields() {
        const cust = document.getElementById('customerName').value.trim();
        const proj = document.getElementById('projectName').value.trim();
        if (!cust || !proj) { alert('Customer Name and Project Name are required.'); return false; }
        return { cust, proj };
    }
	// ── LOE Management (Save, Open, Finalize) ───────────────────────────────
	
    async function saveLoe() {
        const req = checkRequiredFields(); if (!req) return null;
        const riskName = riskSelect.value;
        const riskFactor = riskConfig[riskName] ?? 1;
        const payload = {
            customer: req.cust, project: req.proj,
            data: JSON.stringify({ selectedTasks, taskMultipliers, taskNoteToggles, customNotes, risk: riskName, riskFactor })
        };
        try {
            const res = await window.loeApi.post('/loes', payload);
            const data = await res.json();
            if (res.ok) {
                currentLoadedLoeId = data.id;
                currentLoadedVersion = data.version;
               document.getElementById('currentLoeBadge').textContent = `Editing: ${req.cust} - ${req.proj} (v${data.version})`;
                return { version: data.version, cust: req.cust, proj: req.proj, riskName, riskFactor };
            } else { alert(data.error); return null; }
        } catch(e) { alert(e.message); return null; }
    }
	
    document.getElementById('saveLoeBtn').addEventListener('click', async () => {
        const s = await saveLoe();
        if (s) window.showToast(`Version ${s.version} saved successfully!`);
    });

    document.getElementById('finalizeLoeBtn').addEventListener('click', async () => {
        if (!currentLoadedLoeId) return alert('Please save the LOE first before finalizing.');
        if (!confirm('Mark this version as Final? A public link will be generated.')) return;
        try {
            const res = await window.loeApi.post(`/loes/${currentLoadedLoeId}/finalize`, {});
            const data = await res.json();
            if (res.ok) {
                const fullUrl = window.location.origin + data.url;
                prompt('LOE Finalized! Copy your public link:', fullUrl);
            }
        } catch(e) { alert(e.message); }
    });

    document.getElementById('searchLoeBtn').addEventListener('click', async () => {
		window.location.href = 'loemanager.html';
    });

    window.loadLoeData = async function(id) {
        try {
            const res = await window.loeApi.get(`/loes/${id}`);
            const row = await res.json();
            const payload = JSON.parse(row.data);
            
            document.getElementById('customerName').value = row.customer;
            document.getElementById('projectName').value = row.project;
            selectedTasks = payload.selectedTasks || {};
            taskMultipliers = payload.taskMultipliers || {};
            taskNoteToggles = payload.taskNoteToggles || {};
            customNotes = payload.customNotes || {};
            if (payload.risk) riskSelect.value = payload.risk;
            
            currentLoadedLoeId = row.id;
			currentLoadedVersion = row.version;								   
            document.getElementById('currentLoeBadge').textContent = `Editing: ${row.customer} - ${row.project} (v${row.version})`;
            //document.getElementById('loeManagerModal').style.display = 'none';
            
            //saveSelections();
            renderProductCheckboxes(searchInput.value.trim());
            renderTree(searchInput.value.trim());
            renderTable();
            window.showToast(`Loaded Version ${row.version}`);
        } catch(e) { alert('Error loading LOE.'); }
    };
    // ── Grouped export data ───────────────────────────────────────────────────
    function generateGroupedData() {
        const riskName   = riskSelect.value;
        const riskFactor = riskConfig[riskName] ?? 1;
        const grouped    = {};
        let grandTotal   = 0;
        
        Object.values(selectedTasks).forEach(e => {
            const groupKey = `${e.category} > ${e.product}`;
            if (!grouped[groupKey]) grouped[groupKey] = [];
            
            const taskKey = `${groupKey} > ${e.task}`;
            const mult = e.hasMultiplier ? (taskMultipliers[taskKey] ?? 1) : 1;
            const eff  = e.days * mult * riskFactor;
            grandTotal += eff;

            // Use Custom Note if checkbox is enabled, otherwise default DB note
            const noteText = taskNoteToggles[taskKey] 
                ? (customNotes[taskKey] !== undefined ? customNotes[taskKey] : e.notes)
                : (e.notes || '');

            grouped[groupKey].push({ name: e.task, mult: e.hasMultiplier ? mult : null, days: eff, notes: noteText });
        });
        return { riskName, riskFactor, grouped, grandTotal };
    }

	// ExcelJS High-Quality XLSX Export
    async function getExcelJS() {
        if (window.ExcelJS) return window.ExcelJS;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
            script.onload = () => resolve(window.ExcelJS);
            document.head.appendChild(script);
        });
    }

    function getPlainTextLOE() {
        const cust = document.getElementById('customerName').value || 'N/A';
        const proj = document.getElementById('projectName').value  || 'N/A';
        const { riskName, riskFactor, grouped, grandTotal } = generateGroupedData();
        if (!Object.keys(grouped).length) return 'No tasks selected.';
        const lines = [`Customer: ${cust}`, `Project: ${proj}`, `Risk Level: ${riskName} (${riskFactor})\n`];
        for (const [groupKey, tasks] of Object.entries(grouped)) {
            lines.push(groupKey);
            tasks.forEach(t => {
                const label = t.mult ? `${t.name} (x${t.mult})` : t.name;
                lines.push(`- ${label.padEnd(40,' ')} : ${t.days.toFixed(2)} days${t.notes ? ` [${t.notes}]` : ''}`);
            });
            lines.push('');
        }
        lines.push(`TOTAL: ${grandTotal.toFixed(2)} days`);
        return lines.join('\n');
    }

    // ── Excel Export ──────────────────────────────────────────────────────────
    document.getElementById('exportExcelBtn').addEventListener('click', async () => {
		const saved = await saveLoe(); if (!saved) return;
		const req = checkRequiredFields(); 
		if (!req) 
			return;
        //const cust    = document.getElementById('customerName').value || 'Unknown_Customer';
        //const proj    = document.getElementById('projectName').value  || 'Unknown_Project';
        //const today   = window.todayStr();
        //const defName = `LOE_${cust}_${proj}_${today}.xls`.replace(/\s+/g,'_');
        //const filename = prompt('Enter Excel filename:', defName);
        //if (!filename) return;
        const { riskName, riskFactor, grouped, grandTotal } = generateGroupedData();
        if (!Object.keys(grouped).length) return alert('No tasks selected to export.');

		const ExcelJS = await getExcelJS();
        const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('LOE Export');
		ws.columns = [ { key: 'task', width: 60 }, { key: 'days', width: 15 }, { key: 'notes', width: 80 } ];
		
		ws.mergeCells('A1:C1');
		const titleCell = ws.getCell('A1');
		titleCell.value = `LOE Builder Export - ${new Date().toLocaleDateString()} / v${saved.version}`;
		titleCell.font = { bold: true, name: 'Arial', size: 14 };
		ws.addRow([]);

        ws.mergeCels('B3:C3');
		ws.addRow(['Customer:', saved.cust]).getCell(1).font = { bold: true };
        ws.mergeCels('B4:C4');
		ws.addRow(['Project:', saved.proj]).getCell(1).font = { bold: true };
        ws.mergeCels('B5:C5');
		ws.addRow(['Risk Level:', `${saved.riskName} (x${saved.riskFactor})`]).getCell(1).font = { bold: true };
        ws.addRow([]);
		
        const headerRow = ws.addRow(['Task', 'Days', 'Notes']);
        headerRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6EF6' } };

        for (const [groupKey, tasks] of Object.entries(grouped)) {
            const groupRow = ws.addRow([groupKey, '', '']);
            ws.mergeCells(`A${groupRow.number}:C${groupRow.number}`);
            groupRow.getCell(1).font = { bold: true, color: { argb: 'FF000000' } };
            groupRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
            
            tasks.forEach(t => {
                const label = t.mult ? `${t.name} (x${t.mult})` : t.name;
                const row = ws.addRow([label, Number(t.days.toFixed(2)), t.notes]);
										
                row.getCell(2).numFmt = '0.00';
            });
        }
		
        //ws.addRow([]);
        const totalRow = ws.addRow(['TOTAL', Number(grandTotal.toFixed(2)), '']);
        totalRow.getCell(1).alignment = { horizontal: 'right' };
        totalRow.getCell(1).font = { bold: true, size: 12 };
        totalRow.getCell(2).font = { bold: true, size: 12 };
        totalRow.getCell(2).numFmt = '0.00';

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LOE_${saved.cust}_${saved.proj}_v${saved.version}.xlsx`.replace(/\s+/g,'_');
        a.click();
        window.logAudit('Export Excel', `Exported LOE to ${a.download}`);
    });

	
    document.getElementById('exportTxtBtn').addEventListener('click', async () => {
        const saved = await saveLoe(); if (!saved) return;
        const { riskName, riskFactor, grouped, grandTotal } = generateGroupedData();
        const lines = [`LOE Builder Export - ${new Date().toLocaleDateString()} / v${saved.version}`, `Customer: ${saved.cust}`, `Project: ${saved.proj}`, `Risk Level: ${riskName} (${riskFactor})\n`];
        for (const [gk, tasks] of Object.entries(grouped)) {
            lines.push(gk);
            tasks.forEach(t => { const label = t.mult ? `${t.name} (x${t.mult})` : t.name; lines.push(`- ${label.padEnd(40,' ')} : ${t.days.toFixed(2)} days${t.notes ? ` [${t.notes}]` : ''}`); });
            lines.push('');
        }
        lines.push(`TOTAL: ${grandTotal.toFixed(2)} days`);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
        a.download = `LOE_${saved.cust}_${saved.proj}_v${saved.version}.txt`.replace(/\s+/g,'_');
        a.click();
        window.logAudit('Export TXT', `Exported LOE to ${a.download}`);
    });

    document.getElementById('exportCsvBtn').addEventListener('click', async () => {
        const saved = await saveLoe(); if (!saved) return;
        const { grouped, grandTotal } = generateGroupedData();
																				   
        let csv = `LOE Builder Export - v${saved.version},,,\nGroup,Task,Days,Notes\n`;
        for (const [gk, tasks] of Object.entries(grouped)) {
            tasks.forEach(t => { const label = t.mult ? `${t.name} (x${t.mult})` : t.name; csv += `"${gk}","${label}",${t.days.toFixed(2)},"${t.notes}"\n`; });
        }
        csv += `"","TOTAL",${grandTotal.toFixed(2)},""\n`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `LOE_${saved.cust}_${saved.proj}_v${saved.version}.csv`.replace(/\s+/g,'_');
        a.click();
        window.logAudit('Export CSV', `Exported LOE to ${a.download}`);
    });

    document.getElementById('copyBtn').addEventListener('click', () => {
        const req = checkRequiredFields(); if (!req) return;
        navigator.clipboard.writeText(getPlainTextLOE()).then(() => window.showToast('Copied to clipboard!')).catch(() => window.showToast('Clipboard copy failed.'));
    });
    
    document.getElementById('previewBtn').addEventListener('click', () => {
        document.getElementById('previewText').textContent = getPlainTextLOE();
        document.getElementById('previewModal').style.display = 'flex';
    });
    
    document.getElementById('closePreview').addEventListener('click', () => {
        document.getElementById('previewModal').style.display = 'none';
    });

    document.getElementById('loadExcelLoeBtn').addEventListener('click', () => document.getElementById('loadExcelInput').click());
    document.getElementById('loadExcelInput').addEventListener('change', async (ev) => {
        const file = ev.target.files[0]; ev.target.value = '';
        if (!file) return;
        const loadSheetJS = () => new Promise((resolve, reject) => {
            if (window.XLSX) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
            s.onload = resolve; s.onerror = () => reject(new Error('Could not load SheetJS. Check internet connection.'));
            document.head.appendChild(s);
        });
        try { window.showToast('Loading parser…', 4000); await loadSheetJS(); } catch (e) { alert(e.message); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rows = window.XLSX.utils.sheet_to_json(window.XLSX.read(e.target.result, { type: 'array' }).Sheets[window.XLSX.read(e.target.result, { type: 'array' }).SheetNames[0]], { header: 1, defval: '' });
                let headerIdx = -1, colTask = -1, colDays = -1, colNotes = -1;
                for (let i = 0; i < Math.min(rows.length, 15); i++) {
                    const row = rows[i].map(c => String(c).trim().toLowerCase());
                    const ti  = row.indexOf('task'), di = row.indexOf('days');
                    if (ti !== -1 && di !== -1) { headerIdx = i; colTask = ti; colDays = di; colNotes = row.indexOf('notes'); break; }
                }
                if (headerIdx === -1) { alert('Could not find Task/Days header. Use a valid LOE Builder export.'); return; }
                let currentGroup = '', loaded = 0;
                for (let i = headerIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    const col0 = String(row[colTask] || '').trim();
                    const dVal = parseFloat(row[colDays]);
                    if (!col0) continue;
                    if (col0.includes(' > ') && isNaN(dVal)) { currentGroup = col0; continue; }
                    if (isNaN(dVal) || col0.toUpperCase() === 'TOTAL') continue;
                    let cat = 'Imported', prod = 'General';
                    if (currentGroup) { const parts = currentGroup.split('>').map(s => s.trim()); if (parts.length >= 2) { cat = parts[0]; prod = parts[1]; } }
                    const key = `${cat} > ${prod} > ${col0}`;
                    selectedTasks[key] = { category: cat, product: prod, task: col0, notes: colNotes > -1 ? String(row[colNotes] || '') : '', days: dVal, hasMultiplier: false };
                    loaded++;
                }
                if (!loaded) { alert('No tasks found in Excel file.'); return; }
                saveSelections(); renderProductCheckboxes(searchInput.value.trim()); renderTree(searchInput.value.trim()); renderTable();
                window.logAudit('Import Excel LOE', `Loaded ${loaded} tasks from ${file.name}`);
                window.showToast(`Loaded ${loaded} tasks from ${file.name}`);
            } catch (err) { alert('Error reading Excel: ' + err.message); }
        };
        reader.readAsArrayBuffer(file);
    });

    searchInput.addEventListener('input', () => { const t = searchInput.value.trim(); renderProductCheckboxes(t); renderTree(t); });
    document.getElementById('expandAllBtn').addEventListener('click',   () => treeEl.querySelectorAll('details').forEach(d => d.open = true));
    document.getElementById('collapseAllBtn').addEventListener('click', () => treeEl.querySelectorAll('details').forEach(d => d.open = false));
    document.getElementById('clearSelectionsBtn').addEventListener('click', () => {
        if (!confirm('Clear all selected tasks?')) return;
        selectedTasks = {}; taskMultipliers = {}; taskNoteToggles = {}; customNotes = {};
        saveSelections(); renderProductCheckboxes(searchInput.value.trim()); renderTree(searchInput.value.trim()); renderTable();
        window.showToast('Selections cleared.');
    });

    window.initKeyboardShortcuts('#tree');

    function init() {
        riskConfig = getRiskConfig(); loadSelections(); populateRiskDropdown();
        
        const loadId = localStorage.getItem('loe_load_id');
        if (loadId) {
            localStorage.removeItem('loe_load_id');
            window.loadLoeData(loadId);
        } else {
            // Fresh Empty State
            selectedTasks = {}; taskMultipliers = {}; taskNoteToggles = {}; customNotes = {};
            document.getElementById('customerName').value = '';
            document.getElementById('projectName').value = '';
            document.getElementById('currentLoeBadge').textContent = '';
            currentLoadedLoeId = null;
        }
        renderProductCheckboxes();
		renderTree();
		renderTable();
    }
    init();
});