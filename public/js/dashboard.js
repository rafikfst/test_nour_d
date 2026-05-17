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
                ? `${this.API_URL}/api/reporting?tournee_id=${tourneeId}`
                : `${this.API_URL}/api/reporting`;

            const response = await fetch(url, { headers: this.getHeaders() });
            const reports = await response.json();

            const tableBody = document.getElementById('reports-table-body');
            if (!reports || reports.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucun rapport</td></tr>';
                return;
            }

            tableBody.innerHTML = reports.map(r => `
                <tr>
                    <td>${r.nom_pharmacie || '-'}</td>
                    <td>${r.nom_agent || '-'}</td>
                    <td>${[r.q1, r.q2, r.q3, r.q4].filter(q => q).length} réponses</td>
                    <td><span class="badge ${r.cadeau_assigne ? 'badge-success' : 'badge-error'}">${r.cadeau_description || 'Aucun'}</span></td>
                    <td>${new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Erreur chargement rapports:', error);
        }
    }

    async startGame() {
        const tourneeId = document.getElementById('game-tournee').value;
        const pharmacyId = document.getElementById('game-pharmacy').value;
        const agentId = document.getElementById('game-agent').value;

        if (!tourneeId || !pharmacyId || !agentId) {
            this.showToast('Veuillez sélectionner une tournée, une pharmacie et un agent', 'warning');
            return;
        }

        this.gameState.tourneeId = tourneeId;
        this.gameState.pharmacyId = pharmacyId;
        this.gameState.agentId = agentId;
        this.gameState.currentLevel = 1;
        this.gameState.questionsHistory = [];

        document.getElementById('game-area').style.display = 'block';
        document.getElementById('game-level').textContent = '1 (75%)';

        await this.loadQuestion('75%');
        this.showToast('Jeu commencé ! Bonne chance ! 🎮', 'success');
    }

    async loadQuestion(difficulte) {
        try {
            const response = await fetch(
                `${this.API_URL}/api/questions?difficulte=${difficulte}`,
                { headers: this.getHeaders() }
            );
            const question = await response.json();

            this.gameState.currentQuestion = question;
            document.getElementById('game-question').textContent = question.enonce;

            const allWords = [...question.blocs_corrects, ...question.blocs_pieges];
            this.gameState.wordPool = this.shuffle([...allWords]);
            this.gameState.answerZone = [];

            this.renderWordPool();
            this.renderAnswerZone();
        } catch (error) {
            this.showToast('Erreur chargement question', 'error');
        }
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    renderWordPool() {
        const pool = document.getElementById('word-pool');
        pool.innerHTML = this.gameState.wordPool.map((word, i) => `
            <span class="chip animate-thermal-float" onclick="dashboard.moveToAnswer(${i})" style="animation-delay: ${i * 0.1}s">
                ${word}
            </span>
        `).join('');
    }

    renderAnswerZone() {
        const zone = document.getElementById('answer-zone');
        if (this.gameState.answerZone.length === 0) {
            zone.innerHTML = '<span style="color: #546E7A;">Cliquez sur les mots ci-dessous</span>';
            return;
        }
        zone.innerHTML = this.gameState.answerZone.map((word, i) => `
            <span class="chip placed animate-chip-pop" onclick="dashboard.moveToPool(${i})">
                ${word}
            </span>
        `).join('');
    }

    moveToAnswer(poolIndex) {
        const word = this.gameState.wordPool.splice(poolIndex, 1)[0];
        this.gameState.answerZone.push(word);
        this.renderWordPool();
        this.renderAnswerZone();
    }

    moveToPool(answerIndex) {
        const word = this.gameState.answerZone.splice(answerIndex, 1)[0];
        this.gameState.wordPool.push(word);
        this.renderWordPool();
        this.renderAnswerZone();
    }

    resetAnswer() {
        this.gameState.wordPool = [...this.gameState.wordPool, ...this.gameState.answerZone];
        this.gameState.answerZone = [];
        this.renderWordPool();
        this.renderAnswerZone();
    }

    async validateAnswer() {
        if (this.gameState.answerZone.length === 0) {
            this.showToast('Placez des mots dans la zone de réponse', 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/api/game/submit`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    agent_id: this.gameState.agentId,
                    pharmacy_id: this.gameState.pharmacyId,
                    question_id: this.gameState.currentQuestion.id,
                    reponse: this.gameState.answerZone,
                    niveau_actuel: this.gameState.currentLevel,
                    tournee_id: this.gameState.tourneeId
                })
            });

            const result = await response.json();

            this.gameState.questionsHistory.push({
                question: this.gameState.currentQuestion.enonce,
                reponse: this.gameState.answerZone.join(', '),
                correct: result.correct
            });

            if (result.correct) {
                this.handleCorrectAnswer(result);
            } else {
                this.handleWrongAnswer();
            }
        } catch (error) {
            this.showToast('Erreur validation', 'error');
        }
    }

    handleCorrectAnswer(result) {
        const modal = document.getElementById('result-modal');
        const title = document.getElementById('result-title');
        const body = document.getElementById('result-body');
        const actions = document.getElementById('result-actions');

        if (this.gameState.currentLevel === 4) {
            title.textContent = '🌟 FÉLICITATIONS !';
            body.innerHTML = '<p>Vous avez remporté le SUPER LOT !</p>';
            actions.innerHTML = `<button class="btn btn-success" onclick="dashboard.claimGift(4)">🎁 Prendre le Super Lot</button>`;
        } else {
            const nextLevel = this.gameState.currentLevel + 1;
            title.textContent = '✅ Niveau réussi !';
            body.innerHTML = `
                <p>Niveau ${this.gameState.currentLevel} validé !</p>
                <p>Voulez-vous continuer ?</p>
            `;
            actions.innerHTML = `
                <button class="btn btn-primary" onclick="dashboard.claimGift(${this.gameState.currentLevel})">🎁 Prendre le cadeau</button>
                <button class="btn btn-outline" onclick="dashboard.continueGame()">🚀 Niveau ${nextLevel}</button>
            `;
        }

        modal.style.display = 'flex';
    }

    handleWrongAnswer() {
        document.getElementById('answer-zone').classList.add('animate-wrong-shake');
        setTimeout(() => {
            document.getElementById('answer-zone').classList.remove('animate-wrong-shake');
        }, 600);

        const modal = document.getElementById('result-modal');
        document.getElementById('result-title').textContent = '😔 Perdu...';
        document.getElementById('result-body').innerHTML = '<p>Ce n\'est pas la bonne réponse.</p>';
        document.getElementById('result-actions').innerHTML = `
            <button class="btn btn-primary" onclick="dashboard.closeModal()">OK</button>
        `;
        modal.style.display = 'flex';
    }

    async claimGift(typeCadeau) {
        try {
            await fetch(`${this.API_URL}/api/game/claim-gift`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    agent_id: this.gameState.agentId,
                    tournee_id: this.gameState.tourneeId,
                    type_cadeau: typeCadeau,
                    question_answers: this.gameState.questionsHistory
                })
            });

            this.closeModal();
            this.resetGame();
            this.showToast('🎁 Cadeau attribué !', 'success');
            await this.loadDashboardData();
        } catch (error) {
            this.showToast('Erreur attribution cadeau', 'error');
        }
    }

    async continueGame() {
        this.closeModal();
        this.gameState.currentLevel++;

        const difficultyMap = { 2: '50%', 3: '25%', 4: '1%' };
        document.getElementById('game-level').textContent = `${this.gameState.currentLevel} (${difficultyMap[this.gameState.currentLevel]})`;

        await this.loadQuestion(difficultyMap[this.gameState.currentLevel]);
    }

    closeModal() {
        document.getElementById('result-modal').style.display = 'none';
    }

    resetGame() {
        document.getElementById('game-area').style.display = 'none';
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
        document.getElementById('game-tournee').value = '';
        document.getElementById('game-pharmacy').value = '';
        document.getElementById('game-agent').value = '';
        document.getElementById('start-game-btn').disabled = true;
    }

    async loadGamePharmacies() {
        const tourneeId = document.getElementById('game-tournee').value;
        if (!tourneeId) return;

        const response = await fetch(`${this.API_URL}/api/pharmacies?tournee_id=${tourneeId}`, {
            headers: this.getHeaders()
        });
        const pharmacies = await response.json();

        const select = document.getElementById('game-pharmacy');
        select.innerHTML = '<option value="">Choisir une pharmacie...</option>';
        select.disabled = false;
        pharmacies?.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.nom}</option>`;
        });
    }

    async loadGameAgents() {
        const pharmacyId = document.getElementById('game-pharmacy').value;
        if (!pharmacyId) return;

        const response = await fetch(`${this.API_URL}/api/agents?pharmacy_id=${pharmacyId}`, {
            headers: this.getHeaders()
        });
        const agents = await response.json();

        const select = document.getElementById('game-agent');
        select.innerHTML = '<option value="">Choisir un agent...</option>';
        select.disabled = false;
        agents?.forEach(a => {
            const disabled = a.statut_jeu !== 'Non Joué' ? 'disabled' : '';
            select.innerHTML += `<option value="${a.id}" ${disabled}>${a.nom} ${disabled ? '(Déjà joué)' : ''}</option>`;
        });

        document.getElementById('start-game-btn').disabled = false;
    }

    showTourneeForm(tournee = null) {
        const form = document.getElementById('tournee-form');
        form.style.display = 'block';
        document.getElementById('tournee-form-title').textContent = tournee ? 'Modifier la tournée' : 'Nouvelle tournée';
        document.getElementById('tournee-id').value = tournee?.id || '';

        if (tournee) {
            document.getElementById('tournee-region').value = tournee.region;
            document.getElementById('tournee-debut').value = tournee.date_debut;
            document.getElementById('tournee-fin').value = tournee.date_fin;
            document.getElementById('stock-type1').value = tournee.stock_actuel?.type1 || 50;
            document.getElementById('stock-type2').value = tournee.stock_actuel?.type2 || 30;
            document.getElementById('stock-type3').value = tournee.stock_actuel?.type3 || 10;
            document.getElementById('stock-superlot').value = tournee.stock_actuel?.superlot || 2;
        }
    }

    hideTourneeForm() {
        document.getElementById('tournee-form').style.display = 'none';
    }

    async saveTournee(event) {
        event.preventDefault();

        const tourneeData = {
            region: document.getElementById('tournee-region').value,
            date_debut: document.getElementById('tournee-debut').value,
            date_fin: document.getElementById('tournee-fin').value,
            stock_initial: {
                type1: parseInt(document.getElementById('stock-type1').value),
                type2: parseInt(document.getElementById('stock-type2').value),
                type3: parseInt(document.getElementById('stock-type3').value),
                superlot: parseInt(document.getElementById('stock-superlot').value)
            }
        };

        const tourneeId = document.getElementById('tournee-id').value;
        const url = tourneeId 
            ? `${this.API_URL}/api/tournees/${tourneeId}`
            : `${this.API_URL}/api/tournees`;

        try {
            const response = await fetch(url, {
                method: tourneeId ? 'PUT' : 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(tourneeData)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde');

            this.showToast('Tournée sauvegardée !', 'success');
            this.hideTourneeForm();
            await this.loadTournees();
            await this.loadStats();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async deleteTournee(id) {
        if (!confirm('Supprimer cette tournée ?')) return;

        try {
            await fetch(`${this.API_URL}/api/tournees/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            this.showToast('Tournée supprimée', 'success');
            await this.loadTournees();
            await this.loadStats();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async exportExcel() {
        // Export Excel (utilise la bibliothèque xlsx si disponible)
        this.showToast('Fonctionnalité d\'export à implémenter', 'info');
    }

    showDashboard() {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'block';
        document.getElementById('user-name').textContent = this.profile?.nom || 'Agent';

        if (this.profile?.role === 'admin') {
            document.getElementById('admin-tab').style.display = 'block';
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast animate-slide-in';
        toast.style.cssText = `
            background: white;
            padding: 16px 20px;
            border-radius: 12px;
            margin-bottom: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-left: 4px solid ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#FF9800'};
            font-size: 0.9rem;
        `;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Fonctions globales
const dashboard = new DashboardManager();

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
}

function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    dashboard.login(email, password);
}

function handleRegister(event) {
    event.preventDefault();
    const nom = document.getElementById('reg-nom').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    dashboard.register(nom, email, password);
}

function switchTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    dashboard.currentTab = tab;
    
    // Charger les données selon l'onglet
    if (tab === 'tournees') dashboard.loadTournees();
    if (tab === 'rapports') dashboard.loadReports();
}

function handleLogout() {
    if (confirm('Se déconnecter ?')) {
        fetch(`${dashboard.API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: dashboard.getHeaders()
        }).finally(() => {
            window.location.reload();
        });
    }
}
