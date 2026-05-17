// game.js - Moteur de jeu interactif Avène

class GameEngine {
    constructor() {
        this.API_URL = window.location.origin;
        this.token = localStorage.getItem('avene_token');
        
        // État du jeu
        this.state = {
            tourneeId: null,
            pharmacyId: null,
            agentId: null,
            currentLevel: 1,
            currentQuestion: null,
            answerZone: [],
            wordPool: [],
            questionsHistory: [],
            sessionId: null,
            tourneeData: null
        };

        this.init();
    }

    async init() {
        // Vérifier l'authentification
        if (!this.token) {
            window.location.href = '/';
            return;
        }

        await this.loadTournees();
        this.setupEventListeners();
    }

    async loadTournees() {
        try {
            const response = await fetch(`${this.API_URL}/api/tournees`, {
                headers: auth.getHeaders()
            });
            const tournees = await response.json();

            const select = document.getElementById('tournee-select');
            tournees.forEach(t => {
                const option = document.createElement('option');
                option.value = t.id;
                option.textContent = `${t.region} (${t.date_debut} - ${t.date_fin})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur chargement tournées:', error);
        }
    }

    setupEventListeners() {
        // Sélection tournée
        document.getElementById('tournee-select')?.addEventListener('change', async (e) => {
            this.state.tourneeId = e.target.value;
            if (this.state.tourneeId) {
                await this.loadPharmacies();
                await this.loadTourneeData();
            }
        });

        // Sélection pharmacie
        document.getElementById('pharmacy-select')?.addEventListener('change', async (e) => {
            this.state.pharmacyId = e.target.value;
            if (this.state.pharmacyId) {
                await this.loadAgents();
            }
        });

        // Sélection agent
        document.getElementById('agent-select')?.addEventListener('change', (e) => {
            this.state.agentId = e.target.value;
            document.getElementById('start-game-btn').disabled = !this.state.agentId;
        });

        // Démarrer le jeu
        document.getElementById('start-game-btn')?.addEventListener('click', () => {
            this.startGame();
        });

        // Valider la réponse
        document.getElementById('validate-btn')?.addEventListener('click', () => {
            this.validateAnswer();
        });

        // Réinitialiser la zone de réponse
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            this.resetAnswer();
        });
    }

    async loadPharmacies() {
        const response = await fetch(
            `${this.API_URL}/api/pharmacies?tournee_id=${this.state.tourneeId}`,
            { headers: auth.getHeaders() }
        );
        const pharmacies = await response.json();

        const select = document.getElementById('pharmacy-select');
        select.innerHTML = '<option value="">Choisir une pharmacie...</option>';
        select.disabled = false;

        pharmacies.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.nom} (${p.type})`;
            select.appendChild(option);
        });
    }

    async loadAgents() {
        const response = await fetch(
            `${this.API_URL}/api/agents?pharmacy_id=${this.state.pharmacyId}`,
            { headers: auth.getHeaders() }
        );
        const agents = await response.json();

        const select = document.getElementById('agent-select');
        select.innerHTML = '<option value="">Choisir un agent...</option>';
        select.disabled = false;

        agents.forEach(a => {
            const option = document.createElement('option');
            option.value = a.id;
            option.textContent = `${a.nom} (${a.statut_jeu})`;
            if (a.statut_jeu !== 'Non Joué') {
                option.disabled = true;
                option.textContent += ' - DÉJÀ JOUÉ';
            }
            select.appendChild(option);
        });
    }

    async loadTourneeData() {
        const response = await fetch(
            `${this.API_URL}/api/tournees?id=${this.state.tourneeId}`,
            { headers: auth.getHeaders() }
        );
        const tournees = await response.json();
        this.state.tourneeData = tournees[0] || null;
    }

    async startGame() {
        try {
            // Initialiser la session de jeu
            const response = await fetch(`${this.API_URL}/api/game/init`, {
                method: 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify({
                    agent_id: this.state.agentId,
                    pharmacy_id: this.state.pharmacyId
                })
            });

            const session = await response.json();
            this.state.sessionId = session.id;
            this.state.currentLevel = 1;
            this.state.questionsHistory = [];

            // Masquer l'écran de sélection, afficher le jeu
            document.getElementById('selection-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');

            // Charger la première question
            await this.loadQuestion('75%');
            this.updateLevelIndicator();
        } catch (error) {
            auth.showToast('Erreur lors du démarrage du jeu', 'error');
        }
    }

    async loadQuestion(difficulte) {
        try {
            const response = await fetch(
                `${this.API_URL}/api/questions?difficulte=${difficulte}&agent_id=${this.state.agentId}&pharmacy_id=${this.state.pharmacyId}`,
                { headers: auth.getHeaders() }
            );

            const question = await response.json();
            this.state.currentQuestion = question;
            
            // Préparer les mots
            const allWords = [...question.blocs_corrects, ...question.blocs_pieges];
            this.state.wordPool = this.shuffle([...allWords]);
            this.state.answerZone = [];

            // Afficher la question
            document.getElementById('question-text').textContent = question.enonce;
            
            // Afficher les mots
            this.renderWordPool();
            this.renderAnswerZone();
        } catch (error) {
            auth.showToast('Erreur lors du chargement de la question', 'error');
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
        pool.innerHTML = '';

        this.state.wordPool.forEach((word, index) => {
            const chip = document.createElement('div');
            chip.className = 'chip animate-thermal-float';
            chip.textContent = word;
            chip.style.animationDelay = `${index * 0.1}s`;
            chip.onclick = () => this.moveToAnswer(index);
            pool.appendChild(chip);
        });
    }

    renderAnswerZone() {
        const zone = document.getElementById('answer-zone');
        zone.innerHTML = '';

        if (this.state.answerZone.length === 0) {
            zone.innerHTML = '<span style="color: var(--text-slate-light);">Cliquez sur les mots ci-dessous pour les placer ici</span>';
            return;
        }

        this.state.answerZone.forEach((word, index) => {
            const chip = document.createElement('div');
            chip.className = 'chip placed animate-chip-pop';
            chip.textContent = word;
            chip.onclick = () => this.moveToPool(index);
            zone.appendChild(chip);
        });
    }

    moveToAnswer(poolIndex) {
        const word = this.state.wordPool.splice(poolIndex, 1)[0];
        this.state.answerZone.push(word);
        this.renderWordPool();
        this.renderAnswerZone();
    }

    moveToPool(answerIndex) {
        const word = this.state.answerZone.splice(answerIndex, 1)[0];
        this.state.wordPool.push(word);
        this.renderWordPool();
        this.renderAnswerZone();
    }

    resetAnswer() {
        // Remettre tous les mots dans la pool
        this.state.wordPool = [
            ...this.state.wordPool,
            ...this.state.answerZone
        ];
        this.state.answerZone = [];
        this.renderWordPool();
        this.renderAnswerZone();
    }

    async validateAnswer() {
        if (this.state.answerZone.length === 0) {
            auth.showToast('Veuillez placer des mots dans la zone de réponse', 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/api/game/submit`, {
                method: 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify({
                    agent_id: this.state.agentId,
                    pharmacy_id: this.state.pharmacyId,
                    question_id: this.state.currentQuestion.id,
                    reponse: this.state.answerZone,
                    niveau_actuel: this.state.currentLevel,
                    tournee_id: this.state.tourneeId
                })
            });

            const result = await response.json();

            // Sauvegarder dans l'historique
            this.state.questionsHistory.push({
                question: this.state.currentQuestion.enonce,
                reponse: this.state.answerZone.join(', '),
                correct: result.correct
            });

            if (result.correct) {
                this.handleCorrectAnswer(result);
            } else {
                this.handleWrongAnswer(result);
            }
        } catch (error) {
            auth.showToast('Erreur lors de la validation', 'error');
        }
    }

    handleCorrectAnswer(result) {
        // Animation de succès
        this.showSuccessBubbles();
        
        const difficulteMapping = {
            1: '75%',
            2: '50%',
            3: '25%',
            4: '1%'
        };

        const typeCadeau = this.state.currentLevel;
        const stockKey = typeCadeau === 4 ? 'superlot' : `type${typeCadeau}`;
        const stockRestant = result.stock_actuel?.[stockKey] || 0;

        let modalBody = '';
        let modalActions = '';

        if (this.state.currentLevel === 4) {
            // Niveau 4 réussi -> Super Lot automatique
            modalBody = `
                <p style="color: var(--success-green); font-size: 1.2rem;">🌟 INCROYABLE !</p>
                <p>Vous avez remporté le SUPER LOT !</p>
                <p>Stock restant : ${stockRestant}</p>
            `;
            modalActions = `
                <button class="btn btn-success" onclick="game.claimGift(4)">
                    🎁 Prendre le Super Lot
                </button>
            `;
        } else {
            // Niveaux 1-3 : Choix entre continuer ou prendre le cadeau
            const nextLevel = this.state.currentLevel + 1;
            const nextDifficulte = difficulteMapping[nextLevel];

            modalBody = `
                <p style="color: var(--success-green);">✅ Niveau ${this.state.currentLevel} réussi !</p>
                <p>Stock Type ${typeCadeau} : ${stockRestant}</p>
                ${stockRestant <= 0 ? '<p style="color: var(--warning-orange);">⚠️ Stock limité</p>' : ''}
            `;
            modalActions = `
                <button class="btn btn-primary animate-button-pulse" onclick="game.claimGift(${typeCadeau})">
                    🎁 Prendre Cadeau Type ${typeCadeau}
                </button>
                <button class="btn btn-outline" onclick="game.continueGame()">
                    🚀 Tenter ${nextDifficulte}
                </button>
            `;
        }

        document.getElementById('modal-title').textContent = 'Félicitations !';
        document.getElementById('modal-body').innerHTML = modalBody;
        document.getElementById('modal-actions').innerHTML = modalActions;

        document.getElementById('choice-modal').classList.add('active');
    }

    handleWrongAnswer(result) {
        // Animation d'erreur
        const answerZone = document.getElementById('answer-zone');
        answerZone.classList.add('animate-wrong-shake');
        setTimeout(() => answerZone.classList.remove('animate-wrong-shake'), 600);

        document.getElementById('modal-title').textContent = 'Pas cette fois...';
        document.getElementById('modal-body').innerHTML = `
            <p>😔 Ce n'est pas la bonne réponse.</p>
            <p style="color: var(--primary-salmon);">À la prochaine !</p>
        `;
        document.getElementById('modal-actions').innerHTML = `
            <button class="btn btn-primary" onclick="window.location.href='/'">
                🏠 Retour à l'accueil
            </button>
        `;

        document.getElementById('choice-modal').classList.add('active');
    }

    async claimGift(typeCadeau) {
        try {
            const response = await fetch(`${this.API_URL}/api/game/claim-gift`, {
                method: 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify({
                    agent_id: this.state.agentId,
                    pharmacy_id: this.state.pharmacyId,
                    tournee_id: this.state.tourneeId,
                    type_cadeau: typeCadeau,
                    question_answers: this.state.questionsHistory
                })
            });

            const result = await response.json();

            if (!response.ok) {
                auth.showToast(result.error || 'Erreur', 'error');
                return;
            }

            document.getElementById('choice-modal').classList.remove('active');
            auth.showToast('🎉 Cadeau attribué avec succès !', 'success');

            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } catch (error) {
            auth.showToast('Erreur lors de l\'attribution du cadeau', 'error');
        }
    }

    async continueGame() {
        document.getElementById('choice-modal').classList.remove('active');
        this.state.currentLevel++;

        const difficulteMapping = {
            2: '50%',
            3: '25%',
            4: '1%'
        };

        await this.loadQuestion(difficulteMapping[this.state.currentLevel]);
        this.updateLevelIndicator();
    }

    showSuccessBubbles() {
        const bubbles = document.getElementById('success-bubbles');
        bubbles.classList.remove('hidden');
        bubbles.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'success-bubble';
            bubbles.appendChild(bubble);
        }

        setTimeout(() => {
            bubbles.classList.add('hidden');
        }, 4000);
    }

    updateLevelIndicator() {
        const difficulteMapping = {
            1: '75%',
            2: '50%',
            3: '25%',
            4: '1%'
        };
        document.getElementById('level-indicator').textContent = 
            `Niveau ${this.state.currentLevel} - ${difficulteMapping[this.state.currentLevel]}`;
    }
}

// Initialiser le jeu
const game = new GameEngine();