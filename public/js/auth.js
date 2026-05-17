// auth.js - Gestion de l'authentification

class AuthManager {
    constructor() {
        this.API_URL = window.location.origin;
        this.token = localStorage.getItem('avene_token');
        this.profile = JSON.parse(localStorage.getItem('avene_profile') || 'null');
        
        this.init();
    }

    init() {
        if (this.token && this.profile) {
            this.showDashboard();
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.login();
        });

        // Register form
        document.getElementById('register-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.register();
        });

        // Toggle auth forms
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('register-container').classList.remove('hidden');
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
    }

    async login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

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

            // Stocker le token et le profil
            this.token = data.session.access_token;
            this.profile = data.profile;

            localStorage.setItem('avene_token', this.token);
            localStorage.setItem('avene_profile', JSON.stringify(this.profile));

            this.showDashboard();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async register() {
        const nom = document.getElementById('reg-nom').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

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

            this.showToast('Inscription réussie ! Vérifiez votre email.', 'success');

            // Revenir au formulaire de connexion
            document.getElementById('register-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async logout() {
        try {
            await fetch(`${this.API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });
        } catch (error) {
            console.error('Erreur de déconnexion:', error);
        }

        localStorage.removeItem('avene_token');
        localStorage.removeItem('avene_profile');
        this.token = null;
        this.profile = null;

        window.location.reload();
    }

    showDashboard() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('register-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');

        // Afficher les infos utilisateur
        const userInfo = document.getElementById('user-info');
        if (userInfo && this.profile) {
            userInfo.innerHTML = `
                <h3 class="card-title">Bienvenue, ${this.profile.nom || 'Agent'}</h3>
                <p><strong>Rôle:</strong> ${this.profile.role}</p>
                <p><strong>Région:</strong> ${this.profile.region || 'Non assignée'}</p>
            `;
        }

        // Afficher le bouton admin si l'utilisateur est admin
        if (this.profile?.role === 'admin') {
            document.getElementById('admin-card').classList.remove('hidden');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast`;
        toast.style.borderLeft = `4px solid ${
            type === 'success' ? 'var(--success-green)' :
            type === 'error' ? 'var(--error-red)' :
            'var(--secondary-aqua)'
        }`;
        toast.innerHTML = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }
}

// Initialiser le gestionnaire d'authentification
const auth = new AuthManager();