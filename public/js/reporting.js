// reporting.js - Module de rapports et exports

class ReportingManager {
    constructor() {
        this.API_URL = window.location.origin;
        this.token = localStorage.getItem('avene_token');
        this.allData = [];
        
        this.init();
    }

    async init() {
        if (!this.token) {
            window.location.href = '/';
            return;
        }

        await this.loadTourneesFilter();
        await this.loadData();
        this.setupEventListeners();
    }

    async loadTourneesFilter() {
        try {
            const response = await fetch(`${this.API_URL}/api/tournees`, {
                headers: auth.getHeaders()
            });
            const tournees = await response.json();

            const select = document.getElementById('tournee-filter');
            tournees.forEach(t => {
                const option = document.createElement('option');
                option.value = t.id;
                option.textContent = `${t.region} (${t.date_debut} - ${t.date_fin})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur chargement filtres:', error);
        }
    }

    async loadData(tourneeId = '') {
        try {
            let url = `${this.API_URL}/api/reporting`;
            if (tourneeId) {
                url += `?tournee_id=${tourneeId}`;
            }

            const response = await fetch(url, {
                headers: auth.getHeaders()
            });
            this.allData = await response.json();

            this.renderTable();
        } catch (error) {
            console.error('Erreur chargement données:', error);
            auth.showToast('Erreur lors du chargement des données', 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('tournee-filter')?.addEventListener('change', (e) => {
            this.loadData(e.target.value);
        });

        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportToExcel();
        });
    }

    renderTable() {
        const tbody = document.getElementById('table-body');

        if (this.allData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center">
                        <p>Aucune donnée disponible</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.allData.map(row => `
            <tr>
                <td>${row.nom_pharmacie || '-'}</td>
                <td>${row.nom_agent || '-'}</td>
                <td>${row.q1 || '-'}</td>
                <td>${row.r1 || '-'}</td>
                <td>${row.q2 || '-'}</td>
                <td>${row.r2 || '-'}</td>
                <td>${row.q3 || '-'}</td>
                <td>${row.r3 || '-'}</td>
                <td>${row.q4 || '-'}</td>
                <td>${row.r4 || '-'}</td>
                <td>
                    <span class="badge ${row.cadeau_assigne ? 'badge-success' : 'badge-error'}">
                        ${row.cadeau_description || 'Aucun'}
                    </span>
                </td>
                <td>${new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
            </tr>
        `).join('');
    }

    exportToExcel() {
        if (this.allData.length === 0) {
            auth.showToast('Aucune donnée à exporter', 'warning');
            return;
        }

        // Préparer les données pour Excel
        const excelData = this.allData.map(row => ({
            'Pharmacie': row.nom_pharmacie || '-',
            'Agent': row.nom_agent || '-',
            'Question 1': row.q1 || '-',
            'Réponse 1': row.r1 || '-',
            'Question 2': row.q2 || '-',
            'Réponse 2': row.r2 || '-',
            'Question 3': row.q3 || '-',
            'Réponse 3': row.r3 || '-',
            'Question 4': row.q4 || '-',
            'Réponse 4': row.r4 || '-',
            'Cadeau': row.cadeau_description || 'Aucun',
            'Date': new Date(row.created_at).toLocaleDateString('fr-FR')
        }));

        // Créer le workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Styliser l'en-tête (si possible avec la version de base)
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_col(C) + '1';
            if (!ws[address]) continue;
            ws[address].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: 'E37A5A' } },
                alignment: { horizontal: 'center' }
            };
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Bilan Avène');

        // Générer le nom du fichier
        const tourneeSelect = document.getElementById('tournee-filter');
        const region = tourneeSelect.selectedOptions[0]?.text.split(' (')[0] || 'Toutes';
        const filename = `bilan_avene_${region.replace(/\s+/g, '_')}.xlsx`;

        // Télécharger
        XLSX.writeFile(wb, filename);

        auth.showToast('Export réussi !', 'success');
    }
}

// Initialiser le gestionnaire de rapports
const reporting = new ReportingManager();