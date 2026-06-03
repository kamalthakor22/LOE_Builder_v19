// js/loemanager.js - LOE Builder Pro v19.0 - Search & Filter Logic

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('loeTableBody');
    const searchCustomer = document.getElementById('searchCustomer');
    const searchProject = document.getElementById('searchProject');
    const searchStatus = document.getElementById('searchStatus');
    
    let allLoes = [];

    async function fetchLoes() {
        try {
            const res = await window.loeApi.get('/loes');
            allLoes = await res.json();
            renderTable();
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted" style="color:red;padding:12px;">Failed to load LOEs from server.</td></tr>';
        }
    }

    function renderTable() {
        const custFilter = searchCustomer.value.toLowerCase();
        const projFilter = searchProject.value.toLowerCase();
        const statusFilter = searchStatus.value;

        const filtered = allLoes.filter(l => {
            if (custFilter && !l.customer.toLowerCase().includes(custFilter)) return false;
            if (projFilter && !l.project.toLowerCase().includes(projFilter)) return false;
            if (statusFilter === 'final' && l.is_final !== 1) return false;
            return true;
        });

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:12px;">No LOEs match your search criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(loe => {
            const finalBadge = loe.is_final ? '<span style="color:#16a34a;font-weight:700;">🔒 Yes</span>' : '<span class="muted">No</span>';
            const link = loe.public_link ? `<a href="${loe.public_link}" target="_blank" style="margin-left:8px;color:var(--accent);text-decoration:underline;">View Public Link</a>` : '';
            return `<tr>
                <td><b>${loe.customer}</b></td>
                <td>${loe.project}</td>
                <td>v${loe.version}</td>
                <td>${new Date(loe.created_at).toLocaleDateString()}</td>
                <td>${finalBadge} ${link}</td>
                <td style="text-align:right;">
                    <button class="btn primary-blue small" onclick="openLoeInGenerator(${loe.id})">Open in LOE Generator</button>
                </td>
            </tr>`;
        }).join('');
    }

    searchCustomer.addEventListener('input', renderTable);
    searchProject.addEventListener('input', renderTable);
    searchStatus.addEventListener('change', renderTable);

    window.openLoeInGenerator = function(id) {
        // Set the ID in cache so loegenerator knows to initialize it rather than fresh
        localStorage.setItem('loe_load_id', id);
        window.location.href = 'loegenerator.html';
    };

    fetchLoes();
});