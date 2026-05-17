// admin.js - Module d'administration

class AdminManager {
    constructor() {
        this.API_URL = window.location.origin;
        this.token = localStorage.getItem('avene_token');
        this.profile = JSON.parse(localStorage.getItem('avene_profile') || 'null');
        
        this.init();
    }

    async init() {
        if (!this.token || this.profile?.role !== 'admin') {
            window.location.href = '/';
            return;
        }

        this.setupTabs();
        this.loadUsers();
    }

    setupTabs() {
        document.querySelectorAll('.admin-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Mettre à jour les styles des boutons
                document.querySelectorAll('.admin-tab').forEach(b => {
                    b.className = 'btn btn-outline admin-tab';
                });
                e.target.className = 'btn btn-primary admin-tab';

                // Charger le contenu
                const tab = e.target.dataset.tab;
                switch (tab) {
                    case 'users': this.loadUsers(); break;
                    case 'questions': this.loadQuestions(); break;
                    case 'tournees': this.loadTourneesAdmin(); break;
                    case 'pharmacies': this.loadPharmaciesAdmin(); break;
                    case 'agents': this.loadAgentsAdmin(); break;
                }
            });
        });
    }

    async loadUsers() {
        try {
            const response = await fetch(`${this.API_URL}/api/users`, {
                headers: auth.getHeaders()
            });
            const users = await response.json();

            const content = document.getElementById('tab-content');
            content.innerHTML = `
                <div class="card animate-fade-in">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="card-title">Utilisateurs</h3>
                        <button class="btn btn-primary btn-sm" onclick="admin.showUserForm()">
                            + Ajouter
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Nom</th>
                                    <th>Rôle</th>
                                    <th>Région</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${users.map(u => `
                                    <tr>
                                        <td>${u.email}</td>
                                        <td>${u.nom || '-'}</td>
                                        <td><span class="badge ${u.role === 'admin' ? 'badge-success' : 'badge-info'}">${u.role}</span></td>
                                        <td>${u.region || '-'}</td>
                                        <td>${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                                        <td>
                                            <button class="btn btn-outline btn-sm" onclick="admin.editUser('${u.id}')">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="admin.deleteUser('${u.id}')">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
        }
    }

    async loadQuestions() {
        try {
            const response = await fetch(`${this.API_URL}/api/questions/all`, {
                headers: auth.getHeaders()
            });
            const questions = await response.json();

            const content = document.getElementById('tab-content');
            content.innerHTML = `
                <div class="card animate-fade-in">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="card-title">Questions</h3>
                        <button class="btn btn-primary btn-sm" onclick="admin.showQuestionForm()">
                            + Ajouter
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Difficulté</th>
                                    <th>Énoncé</th>
                                    <th>Réponse correcte</th>
                                    <th>Pièges</th>
                                    <th>Actif</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${questions.map(q => `
                                    <tr>
                                        <td><span class="badge badge-warning">${q.difficulte}</span></td>
                                        <td>${q.enonce.substring(0, 50)}...</td>
                                        <td>${q.blocs_corrects.join(', ')}</td>
                                        <td>${q.blocs_pieges.join(', ')}</td>
                                        <td>${q.actif ? '✅' : '❌'}</td>
                                        <td>
                                            <button class="btn btn-outline btn-sm" onclick="admin.editQuestion(${q.id})">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="admin.deleteQuestion(${q.id})">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erreur chargement questions:', error);
        }
    }

    async loadTourneesAdmin() {
        try {
            const response = await fetch(`${this.API_URL}/api/tournees`, {
                headers: auth.getHeaders()
            });
            const tournees = await response.json();

            const content = document.getElementById('tab-content');
            content.innerHTML = `
                <div class="card animate-fade-in">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="card-title">Tournées</h3>
                        <button class="btn btn-primary btn-sm" onclick="admin.showTourneeForm()">
                            + Ajouter
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Région</th>
                                    <th>Dates</th>
                                    <th>Stock Initial</th>
                                    <th>Stock Actuel</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tournees.map(t => `
                                    <tr>
                                        <td>${t.region}</td>
                                        <td>${t.date_debut} - ${t.date_fin}</td>
                                        <td>${JSON.stringify(t.stock_initial)}</td>
                                        <td>${JSON.stringify(t.stock_actuel)}</td>
                                        <td>
                                            <button class="btn btn-outline btn-sm" onclick="admin.editTournee(${t.id})">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="admin.deleteTournee(${t.id})">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erreur chargement tournées:', error);
        }
    }

    async loadPharmaciesAdmin() {
        try {
            const response = await fetch(`${this.API_URL}/api/pharmacies`, {
                headers: auth.getHeaders()
            });
            const pharmacies = await response.json();

            const content = document.getElementById('tab-content');
            content.innerHTML = `
                <div class="card animate-fade-in">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="card-title">Pharmacies</h3>
                        <button class="btn btn-primary btn-sm" onclick="admin.showPharmacyForm()">
                            + Ajouter
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Type</th>
                                    <th>Téléphone</th>
                                    <th>Visitée</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pharmacies.map(p => `
                                    <tr>
                                        <td>${p.nom}</td>
                                        <td>${p.type}</td>
                                        <td>${p.telephone || '-'}</td>
                                        <td>${p.est_visitee ? '✅' : '❌'}</td>
                                        <td>
                                            <button class="btn btn-outline btn-sm" onclick="admin.editPharmacy(${p.id})">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="admin.deletePharmacy(${p.id})">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erreur chargement pharmacies:', error);
        }
    }

    async loadAgentsAdmin() {
        try {
            const response = await fetch(`${this.API_URL}/api/agents`, {
                headers: auth.getHeaders()
            });
            const agents = await response.json();

            const content = document.getElementById('tab-content');
            content.innerHTML = `
                <div class="card animate-fade-in">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="card-title">Agents</h3>
                        <button class="btn btn-primary btn-sm" onclick="admin.showAgentForm()">
                            + Ajouter
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Email</th>
                                    <th>Téléphone</th>
                                    <th>Statut</th>
                                    <th>Pharmacie</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${agents.map(a => `
                                    <tr>
                                        <td>${a.nom}</td>
                                        <td>${a.email || '-'}</td>
                                        <td>${a.telephone || '-'}</td>
                                        <td><span class="badge ${a.statut_jeu === 'Non Joué' ? 'badge-info' : 'badge-success'}">${a.statut_jeu}</span></td>
                                        <td>${a.pharmacies?.nom || '-'}</td>
                                        <td>
                                            <button class="btn btn-outline btn-sm" onclick="admin.editAgent(${a.id})">✏️</button>
                                            <button class="btn btn-danger btn-sm" onclick="admin.deleteAgent(${a.id})">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erreur chargement agents:', error);
        }
    }

    showUserForm(user = null) {
        const content = document.getElementById('tab-content');
        content.innerHTML = `
            <div class="card animate-fade-in">
                <h3 class="card-title">${user ? 'Modifier' : 'Ajouter'} un utilisateur</h3>
                <form onsubmit="admin.saveUser(event, '${user?.id || ''}')">
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="user-email" class="input-field" value="${user?.email || ''}" required>
                    </div>
                    ${!user ? `
                    <div class="input-group">
                        <label>Mot de passe</label>
                        <input type="password" id="user-password" class="input-field" required>
                    </div>
                    ` : ''}
                    <div class="input-group">
                        <label>Nom</label>
                        <input type="text" id="user-nom" class="input-field" value="${user?.nom || ''}">
                    </div>
                    <div class="input-group">
                        <label>Rôle</label>
                        <select id="user-role" class="input-field">
                            <option value="agent" ${user?.role === 'agent' ? 'selected' : ''}>Agent</option>
                            <option value="superviseur" ${user?.role === 'superviseur' ? 'selected' : ''}>Superviseur</option>
                            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Région</label>
                        <input type="text" id="user-region" class="input-field" value="${user?.region || ''}">
                    </div>
                    <div class="flex gap-1">
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                        <button type="button" class="btn btn-outline" onclick="admin.loadUsers()">Annuler</button>
                    </div>
                </form>
            </div>
        `;
    }

    async saveUser(event, userId) {
        event.preventDefault();
        
        const userData = {
            nom: document.getElementById('user-nom').value,
            role: document.getElementById('user-role').value,
            region: document.getElementById('user-region').value
        };

        if (!userId) {
            userData.email = document.getElementById('user-email').value;
            userData.password = document.getElementById('user-password').value;
        }

        try {
            const url = userId 
                ? `${this.API_URL}/api/users/${userId}`
                : `${this.API_URL}/api/auth/register`;

            const response = await fetch(url, {
                method: userId ? 'PUT' : 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error);
            }

            auth.showToast('Utilisateur sauvegardé !', 'success');
            this.loadUsers();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Supprimer cet utilisateur ?')) return;

        try {
            const response = await fetch(`${this.API_URL}/api/users/${userId}`, {
                method: 'DELETE',
                headers: auth.getHeaders()
            });

            if (!response.ok) throw new Error('Erreur suppression');

            auth.showToast('Utilisateur supprimé', 'success');
            this.loadUsers();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    // Méthodes similaires pour les autres entités (questions, tournées, etc.)
    async showQuestionForm(question = null) {
        const content = document.getElementById('tab-content');
        content.innerHTML = `
            <div class="card animate-fade-in">
                <h3 class="card-title">${question ? 'Modifier' : 'Ajouter'} une question</h3>
                <form onsubmit="admin.saveQuestion(event, ${question?.id || 'null'})">
                    <div class="input-group">
                        <label>Difficulté</label>
                        <select id="q-difficulte" class="input-field" required>
                            <option value="75%" ${question?.difficulte === '75%' ? 'selected' : ''}>75%</option>
                            <option value="50%" ${question?.difficulte === '50%' ? 'selected' : ''}>50%</option>
                            <option value="25%" ${question?.difficulte === '25%' ? 'selected' : ''}>25%</option>
                            <option value="1%" ${question?.difficulte === '1%' ? 'selected' : ''}>1%</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Énoncé</label>
                        <textarea id="q-enonce" class="input-field" rows="3" required>${question?.enonce || ''}</textarea>
                    </div>
                    <div class="input-group">
                        <label>Blocs corrects (séparés par des virgules)</label>
                        <input type="text" id="q-corrects" class="input-field" value="${question?.blocs_corrects?.join(', ') || ''}" required>
                    </div>
                    <div class="input-group">
                        <label>Blocs pièges (séparés par des virgules)</label>
                        <input type="text" id="q-pieges" class="input-field" value="${question?.blocs_pieges?.join(', ') || ''}" required>
                    </div>
                    <div class="input-group">
                        <label>
                            <input type="checkbox" id="q-actif" ${question?.actif !== false ? 'checked' : ''}>
                            Actif
                        </label>
                    </div>
                    <div class="flex gap-1">
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                        <button type="button" class="btn btn-outline" onclick="admin.loadQuestions()">Annuler</button>
                    </div>
                </form>
            </div>
        `;
    }

    async saveQuestion(event, questionId) {
        event.preventDefault();
        
        const questionData = {
            difficulte: document.getElementById('q-difficulte').value,
            enonce: document.getElementById('q-enonce').value,
            blocs_corrects: document.getElementById('q-corrects').value.split(',').map(s => s.trim()),
            blocs_pieges: document.getElementById('q-pieges').value.split(',').map(s => s.trim()),
            actif: document.getElementById('q-actif').checked
        };

        try {
            const url = questionId 
                ? `${this.API_URL}/api/questions/${questionId}`
                : `${this.API_URL}/api/questions`;

            const response = await fetch(url, {
                method: questionId ? 'PUT' : 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify(questionData)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde');

            auth.showToast('Question sauvegardée !', 'success');
            this.loadQuestions();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    async deleteQuestion(questionId) {
        if (!confirm('Supprimer cette question ?')) return;

        try {
            await fetch(`${this.API_URL}/api/questions/${questionId}`, {
                method: 'DELETE',
                headers: auth.getHeaders()
            });

            auth.showToast('Question supprimée', 'success');
            this.loadQuestions();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    // Méthodes pour les tournées, pharmacies et agents...
    async deleteTournee(id) {
        if (!confirm('Supprimer cette tournée ? Toutes les pharmacies associées seront supprimées.')) return;
        try {
            await fetch(`${this.API_URL}/api/tournees/${id}`, {
                method: 'DELETE',
                headers: auth.getHeaders()
            });
            auth.showToast('Tournée supprimée', 'success');
            this.loadTourneesAdmin();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    async deletePharmacy(id) {
        if (!confirm('Supprimer cette pharmacie ?')) return;
        try {
            await fetch(`${this.API_URL}/api/pharmacies/${id}`, {
                method: 'DELETE',
                headers: auth.getHeaders()
            });
            auth.showToast('Pharmacie supprimée', 'success');
            this.loadPharmaciesAdmin();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    async deleteAgent(id) {
        if (!confirm('Supprimer cet agent ?')) return;
        try {
            await fetch(`${this.API_URL}/api/agents/${id}`, {
                method: 'DELETE',
                headers: auth.getHeaders()
            });
            auth.showToast('Agent supprimé', 'success');
            this.loadAgentsAdmin();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    // Forms pour tournées, pharmacies, agents
    showTourneeForm(tournee = null) {
        const content = document.getElementById('tab-content');
        content.innerHTML = `
            <div class="card animate-fade-in">
                <h3 class="card-title">${tournee ? 'Modifier' : 'Ajouter'} une tournée</h3>
                <form onsubmit="admin.saveTournee(event, ${tournee?.id || 'null'})">
                    <div class="input-group">
                        <label>Région</label>
                        <input type="text" id="t-region" class="input-field" value="${tournee?.region || ''}" required>
                    </div>
                    <div class="grid grid-2">
                        <div class="input-group">
                            <label>Date début</label>
                            <input type="date" id="t-debut" class="input-field" value="${tournee?.date_debut || ''}" required>
                        </div>
                        <div class="input-group">
                            <label>Date fin</label>
                            <input type="date" id="t-fin" class="input-field" value="${tournee?.date_fin || ''}" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Stock initial (JSON)</label>
                        <input type="text" id="t-stock" class="input-field" value='${JSON.stringify(tournee?.stock_initial || {type1: 50, type2: 30, type3: 10, superlot: 2})}' required>
                    </div>
                    <div class="flex gap-1">
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                        <button type="button" class="btn btn-outline" onclick="admin.loadTourneesAdmin()">Annuler</button>
                    </div>
                </form>
            </div>
        `;
    }

    async saveTournee(event, tourneeId) {
        event.preventDefault();
        
        const tourneeData = {
            region: document.getElementById('t-region').value,
            date_debut: document.getElementById('t-debut').value,
            date_fin: document.getElementById('t-fin').value,
            stock_initial: JSON.parse(document.getElementById('t-stock').value)
        };

        if (!tourneeId) {
            tourneeData.stock_actuel = tourneeData.stock_initial;
        }

        try {
            const url = tourneeId 
                ? `${this.API_URL}/api/tournees/${tourneeId}`
                : `${this.API_URL}/api/tournees`;

            const response = await fetch(url, {
                method: tourneeId ? 'PUT' : 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify(tourneeData)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde');

            auth.showToast('Tournée sauvegardée !', 'success');
            this.loadTourneesAdmin();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    showPharmacyForm(pharmacy = null) {
        const content = document.getElementById('tab-content');
        content.innerHTML = `
            <div class="card animate-fade-in">
                <h3 class="card-title">${pharmacy ? 'Modifier' : 'Ajouter'} une pharmacie</h3>
                <form onsubmit="admin.savePharmacy(event, ${pharmacy?.id || 'null'})">
                    <div class="input-group">
                        <label>Tournée</label>
                        <select id="p-tournee" class="input-field" required>
                            <option value="">Choisir...</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Nom</label>
                        <input type="text" id="p-nom" class="input-field" value="${pharmacy?.nom || ''}" required>
                    </div>
                    <div class="input-group">
                        <label>Type</label>
                        <select id="p-type" class="input-field" required>
                            <option value="pharmacie" ${pharmacy?.type === 'pharmacie' ? 'selected' : ''}>Pharmacie</option>
                            <option value="para" ${pharmacy?.type === 'para' ? 'selected' : ''}>Parapharmacie</option>
                            <option value="fournisseur" ${pharmacy?.type === 'fournisseur' ? 'selected' : ''}>Fournisseur</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Téléphone</label>
                        <input type="text" id="p-tel" class="input-field" value="${pharmacy?.telephone || ''}">
                    </div>
                    <div class="flex gap-1">
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                        <button type="button" class="btn btn-outline" onclick="admin.loadPharmaciesAdmin()">Annuler</button>
                    </div>
                </form>
            </div>
        `;

        // Charger les tournées dans le select
        this.loadTourneesForSelect('p-tournee', pharmacy?.tournee_id);
    }

    async loadTourneesForSelect(selectId, selectedId = null) {
        const response = await fetch(`${this.API_URL}/api/tournees`, {
            headers: auth.getHeaders()
        });
        const tournees = await response.json();

        const select = document.getElementById(selectId);
        tournees.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.region;
            if (t.id === selectedId) option.selected = true;
            select.appendChild(option);
        });
    }

    async savePharmacy(event, pharmacyId) {
        event.preventDefault();
        
        const pharmacyData = {
            tournee_id: parseInt(document.getElementById('p-tournee').value),
            nom: document.getElementById('p-nom').value,
            type: document.getElementById('p-type').value,
            telephone: document.getElementById('p-tel').value
        };

        try {
            const url = pharmacyId 
                ? `${this.API_URL}/api/pharmacies/${pharmacyId}`
                : `${this.API_URL}/api/pharmacies`;

            const response = await fetch(url, {
                method: pharmacyId ? 'PUT' : 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify(pharmacyData)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde');

            auth.showToast('Pharmacie sauvegardée !', 'success');
            this.loadPharmaciesAdmin();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }

    showAgentForm(agent = null) {
        const content = document.getElementById('tab-content');
        content.innerHTML = `
            <div class="card animate-fade-in">
                <h3 class="card-title">${agent ? 'Modifier' : 'Ajouter'} un agent</h3>
                <form onsubmit="admin.saveAgent(event, ${agent?.id || 'null'})">
                    <div class="input-group">
                        <label>Pharmacie</label>
                        <select id="a-pharmacy" class="input-field" required>
                            <option value="">Choisir...</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Nom</label>
                        <input type="text" id="a-nom" class="input-field" value="${agent?.nom || ''}" required>
                    </div>
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="a-email" class="input-field" value="${agent?.email || ''}">
                    </div>
                    <div class="input-group">
                        <label>Téléphone</label>
                        <input type="text" id="a-tel" class="input-field" value="${agent?.telephone || ''}">
                    </div>
                    <div class="flex gap-1">
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                        <button type="button" class="btn btn-outline" onclick="admin.loadAgentsAdmin()">Annuler</button>
                    </div>
                </form>
            </div>
        `;

        this.loadPharmaciesForSelect('a-pharmacy', agent?.pharmacy_id);
    }

    async saveAgent(event, agentId) {
        event.preventDefault();
        
        const agentData = {
            pharmacy_id: parseInt(document.getElementById('a-pharmacy').value),
            nom: document.getElementById('a-nom').value,
            email: document.getElementById('a-email').value,
            telephone: document.getElementById('a-tel').value
        };

        try {
            const url = agentId 
                ? `${this.API_URL}/api/agents/${agentId}`
                : `${this.API_URL}/api/agents`;

            const response = await fetch(url, {
                method: agentId ? 'PUT' : 'POST',
                headers: auth.getHeaders(),
                body: JSON.stringify(agentData)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde');

            auth.showToast('Agent sauvegardé !', 'success');
            this.loadAgentsAdmin();
        } catch (error) {
            auth.showToast(error.message, 'error');
        }
    }
}

// Initialiser l'admin
const admin = new AdminManager();