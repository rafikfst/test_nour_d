// dashboard.js - Gestion complète du dashboard Avène
class DashboardManager {
    constructor() {
        this.API_URL = window.location.origin;
        this.token = null;
        this.profile = null;
        this.currentTab = 'accueil';
        
        // État du jeu
        this.gameState = {
            tourneeId: null,
            pharmacyId: null,
            agentId: null,
            currentLevel: 1,
            currentQuestion: null,
            answerZone: [],
            wordPool: [],
            questionsHistory: []
        };

        this.init();
    }

    async init() {
        // Vérifier si une session existe dans Supabase
        await this.checkSession();
        
        if (this.token && this.profile) {
            this.showDashboard();
            await this.loadDashboardData();
        }
    }

    async checkSession() {
        // Essayer de récupérer la session depuis Supabase
        const sessionData = await this.getFromSupabase('user_sessions', {
            filters: { last_activity: 'now' }
        });
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur de connexion');
            }

            // Sauvegarder dans Supabase
            await this.saveSession(data.session.access_token, data.profile);
            
            this.token = data.session.access_token;
            this.profile = data.profile;

            this.showDashboard();
            await this.loadDashboardData();
            this.showToast('Connexion réussie !', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async register(nom, email, password) {
        try {
            const response = await fetch(`${this.API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, nom })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur d\'inscription');
            }

            this.showToast('Inscription réussie ! Vous pouvez vous connecter.', 'success');
            switchAuthTab('login');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async saveSession(token, profile) {
        try {
            await fetch(`${this.API_URL}/api/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    token,
                    user_id: profile.id,
                    profile_data: profile
                })
            });
        } catch (error) {
            console.error('Erreur sauvegarde session:', error);
        }
    }

    async getFromSupabase(table, options = {}) {
        try {
            const response = await fetch(`${this.API_URL}/api/data/${table}`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error(`Erreur chargement ${table}:`, error);
            return null;
        }
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    async loadDashboardData() {
        await Promise.all([
            this.loadStats(),
            this.loadRecentActivity(),
            this.loadTournees(),
            this.loadReportsFilter()
        ]);
    }

    async loadStats() {
        try {
            const [tournees, pharmacies, agents, bilans] = await Promise.all([
                fetch(`${this.API_URL}/api/tournees`, { headers: this.getHeaders() }).then(r => r.json()),
                fetch(`${this.API_URL}/api/pharmacies`, { headers: this.getHeaders() }).then(r => r.json()),
                fetch(`${this.API_URL}/api/agents`, { headers: this.getHeaders() }).then(r => r.json()),
                fetch(`${this.API_URL}/api/reporting`, { headers: this.getHeaders() }).then(r => r.json())
            ]);

            document.getElementById('stat-tournees').textContent = tournees?.length || 0;
            document.getElementById('stat-pharmacies').textContent = pharmacies?.length || 0;
            document.getElementById('stat-agents').textContent = agents?.length || 0;
            document.getElementById('stat-cadeaux').textContent = bilans?.filter(b => b.cadeau_assigne)?.length || 0;
        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const response = await fetch(`${this.API_URL}/api/activity`, {
                headers: this.getHeaders()
            });
            const activities = await response.json();

            const container = document.getElementById('recent-activity');
            if (!activities || activities.length === 0) {
                container.innerHTML = '<p style="color: #546E7A; text-align: center;">Aucune activité récente</p>';
                return;
            }

            container.innerHTML = activities.slice(0, 10).map(a => `
                <div style="padding: 12px; border-bottom: 1px solid #E8F0FE; display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.2rem;">${this.getActivityIcon(a.action)}</span>
                    <div style="flex: 1;">
                        <p style="margin: 0; font-weight: 500;">${a.action}</p>
                        <p style="margin: 0; font-size: 0.8rem; color: #546E7A;">${new Date(a.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Erreur chargement activité:', error);
        }
    }

    getActivityIcon(action) {
        const icons = {
            'connexion': '🔑',
            'jeu': '🎮',
            'cadeau': '🎁',
            'tournee': '🗺️',
            'rapport': '📊'
        };
        return icons[action] || '📝';
    }

    async loadTournees() {
        try {
            const response = await fetch(`${this.API_URL}/api/tournees`, {
                headers: this.getHeaders()
            });
            const tournees = await response.json();

            // Mettre à jour le select du jeu
            const gameSelect = document.getElementById('game-tournee');
            if (gameSelect) {
                gameSelect.innerHTML = '<option value="">Choisir une tournée...</option>';
                tournees?.forEach(t => {
                    gameSelect.innerHTML += `<option value="${t.id}">${t.region} (${t.date_debut} - ${t.date_fin})</option>`;
                });
            }

            // Mettre à jour le tableau des tournées
            const tableBody = document.getElementById('tournees-table-body');
            if (tableBody) {
                if (!tournees || tournees.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Aucune tournée</td></tr>';
                    return;
                }

                tableBody.innerHTML = tournees.map(t => `
                    <tr>
                        <td>${t.region}</td>
                        <td>${t.date_debut} → ${t.date_fin}</td>
                        <td>${t.stock_actuel?.type1 || 0}</td>
                        <td>${t.stock_actuel?.type2 || 0}</td>
                        <td>${t.stock_actuel?.type3 || 0}</td>
                        <td>${t.stock_actuel?.superlot || 0}</td>
                        <td>
                            <button class="btn btn-outline btn-sm" onclick="dashboard.editTournee(${t.id})">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="dashboard.deleteTournee(${t.id})">🗑️</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Erreur chargement tournées:', error);
        }
    }

    async loadReportsFilter() {
        try {
            const response = await fetch(`${this.API_URL}/api/tournees`, {
                headers: this.getHeaders()
            });
            const tournees = await response.json();

            const select = document.getElementById('report-tournee-filter');
            if (select) {
                select.innerHTML = '<option value="">Toutes les tournées</option>';
                tournees?.forEach(t => {
                    select.innerHTML += `<option value="${t.id}">${t.region}</option>`;
                });
            }
        } catch (error) {
            console.error('Erreur chargement filtre:', error);
        }
    }

    async loadReports() {
        try {
            const tourneeId = document.getElementById('report-tournee-filter')?.value || '';
            const url = tourneeId 
                ? `${this.API_URL
