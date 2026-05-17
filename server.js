// server.js - Eau Thermale Avène Platform
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONFIGURATION SUPABASE ============
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERREUR: Variables SUPABASE manquantes dans .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

console.log('✅ Supabase connecté:', supabaseUrl);

// ============ MIDDLEWARES ============
app.use(cors());
app.use(express.json());

// 🔴 CRUCIAL: Servir les fichiers statiques AVANT les routes
const publicPath = path.join(__dirname, 'public');
console.log('📁 Dossier public:', publicPath);
console.log('📄 Fichiers trouvés:', fs.readdirSync(publicPath));

app.use(express.static(publicPath));

// Log toutes les requêtes
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
});

// ============ MIDDLEWARE AUTH ============
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
        console.error('❌ Auth error:', error);
        return res.status(401).json({ error: 'Token invalide' });
    }

    req.user = user;
    next();
};

const requireAdmin = async (req, res, next) => {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé. Admin requis.' });
    }

    req.profile = profile;
    next();
};

// ============ ROUTES PAGES HTML ============

// Page d'accueil (login)
app.get('/', (req, res) => {
    console.log('➡️ Page accueil demandée');
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Pages HTML nommées explicitement
app.get('/game.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'game.html'));
});

app.get('/reporting.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'reporting.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});

// ============ AUTHENTIFICATION ============

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, nom } = req.body;
        console.log('📝 Tentative inscription:', email);

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError) throw authError;

        if (authData.user) {
            await supabase
                .from('profiles')
                .update({ nom })
                .eq('id', authData.user.id);
        }

        console.log('✅ Inscription réussie:', email);
        res.json({
            success: true,
            user: authData.user,
            message: 'Inscription réussie !'
        });
    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔑 Tentative connexion:', email);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        console.log('✅ Connexion réussie:', email, '- Rôle:', profile?.role);
        res.json({
            success: true,
            session: data.session,
            profile: profile
        });
    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    res.json({ success: true });
});

// ============ GESTION UTILISATEURS ============

// GET /api/users
app.get('/api/users', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/users/:id
app.put('/api/users/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { nom, role, region } = req.body;
        const { data, error } = await supabase
            .from('profiles')
            .update({ nom, role, region })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        // Supprimer le profil
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', req.params.id);

        if (profileError) throw profileError;

        // Supprimer l'utilisateur auth
        await supabaseAdmin.auth.admin.deleteUser(req.params.id);

        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ GESTION TOURNÉES ============

// GET /api/tournees
app.get('/api/tournees', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tournees')
            .select('*')
            .order('date_debut', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tournees
app.post('/api/tournees', authenticateUser, async (req, res) => {
    try {
        const { region, date_debut, date_fin, stock_initial } = req.body;
        
        const newTournee = {
            region,
            date_debut,
            date_fin,
            stock_initial,
            stock_actuel: stock_initial,
            created_by: req.user.id
        };

        const { data, error } = await supabase
            .from('tournees')
            .insert([newTournee])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/tournees/:id
app.put('/api/tournees/:id', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tournees')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/tournees/:id
app.delete('/api/tournees/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('tournees')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ GESTION PHARMACIES ============

// GET /api/pharmacies
app.get('/api/pharmacies', authenticateUser, async (req, res) => {
    try {
        let query = supabase.from('pharmacies').select('*');

        const { tournee_id } = req.query;
        if (tournee_id) {
            query = query.eq('tournee_id', tournee_id);
        }

        const { data, error } = await query.order('nom');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/pharmacies
app.post('/api/pharmacies', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pharmacies')
            .insert([req.body])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/pharmacies/:id
app.put('/api/pharmacies/:id', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pharmacies')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/pharmacies/:id
app.delete('/api/pharmacies/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('pharmacies')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ GESTION AGENTS ============

// GET /api/agents
app.get('/api/agents', authenticateUser, async (req, res) => {
    try {
        let query = supabase.from('agents').select('*, pharmacies(nom)');
        
        const { pharmacy_id } = req.query;
        if (pharmacy_id) {
            query = query.eq('pharmacy_id', pharmacy_id);
        }

        const { data, error } = await query.order('nom');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/agents
app.post('/api/agents', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agents')
            .insert([req.body])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/agents/:id
app.put('/api/agents/:id', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agents')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/agents/:id
app.delete('/api/agents/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ MOTEUR DE JEU ============

// GET /api/questions
app.get('/api/questions', authenticateUser, async (req, res) => {
    try {
        const { difficulte } = req.query;

        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('difficulte', difficulte)
            .eq('actif', true);

        if (error) throw error;
        if (!questions || questions.length === 0) {
            return res.status(404).json({ error: 'Aucune question disponible' });
        }

        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        res.json(randomQuestion);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/game/submit
app.post('/api/game/submit', authenticateUser, async (req, res) => {
    try {
        const {
            agent_id,
            pharmacy_id,
            question_id,
            reponse,
            niveau_actuel,
            tournee_id
        } = req.body;

        const { data: question, error: questionError } = await supabase
            .from('questions')
            .select('*')
            .eq('id', question_id)
            .single();

        if (questionError) throw questionError;

        const isCorrect = JSON.stringify(reponse) === JSON.stringify(question.blocs_corrects);

        // Mettre à jour le statut de l'agent si perdu
        if (!isCorrect) {
            await supabase.from('agents')
                .update({ statut_jeu: 'Perdu' })
                .eq('id', agent_id);

            // Enregistrer dans le bilan
            const { data: agent } = await supabase
                .from('agents')
                .select('nom, pharmacies(nom)')
                .eq('id', agent_id)
                .single();

            await supabase.from('bilans').insert([{
                tournee_id,
                nom_pharmacie: agent?.pharmacies?.nom || 'Inconnue',
                nom_agent: agent?.nom || 'Inconnu',
                q1: question.enonce,
                r1: reponse.join(', '),
                cadeau_description: 'Perdu'
            }]);
        }

        const { data: tournee } = await supabase
            .from('tournees')
            .select('stock_actuel')
            .eq('id', tournee_id)
            .single();

        res.json({
            correct: isCorrect,
            reponse_correcte: question.blocs_corrects,
            stock_actuel: tournee?.stock_actuel || null
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/game/claim-gift
app.post('/api/game/claim-gift', authenticateUser, async (req, res) => {
    try {
        const {
            agent_id,
            tournee_id,
            type_cadeau,
            question_answers
        } = req.body;

        const stockMapping = {
            1: 'type1',
            2: 'type2',
            3: 'type3',
            4: 'superlot'
        };

        const stockKey = stockMapping[type_cadeau];
        if (!stockKey) {
            return res.status(400).json({ error: 'Type de cadeau invalide' });
        }

        // Vérifier le stock
        const { data: tournee, error: tourneeError } = await supabase
            .from('tournees')
            .select('stock_actuel')
            .eq('id', tournee_id)
            .single();

        if (tourneeError) throw tourneeError;

        const stockActuel = tournee.stock_actuel;
        if (stockActuel[stockKey] <= 0) {
            return res.status(400).json({
                error: 'Stock épuisé',
                message: `Le stock de cadeaux de type ${type_cadeau} est épuisé.`
            });
        }

        // Décrémenter le stock
        stockActuel[stockKey] -= 1;
        await supabase
            .from('tournees')
            .update({ stock_actuel: stockActuel })
            .eq('id', tournee_id);

        // Mettre à jour l'agent
        const statutMapping = {
            1: 'Gagné Type 1',
            2: 'Gagné Type 2',
            3: 'Gagné Type 3',
            4: 'Gagné Super Lot'
        };

        await supabase
            .from('agents')
            .update({ statut_jeu: statutMapping[type_cadeau] })
            .eq('id', agent_id);

        // Enregistrer dans le bilan
        const { data: agent } = await supabase
            .from('agents')
            .select('nom, pharmacies(nom)')
            .eq('id', agent_id)
            .single();

        const bilanEntry = {
            tournee_id,
            nom_pharmacie: agent?.pharmacies?.nom || 'Inconnue',
            nom_agent: agent?.nom || 'Inconnu',
            cadeau_assigne: true,
            cadeau_description: statutMapping[type_cadeau]
        };

        // Ajouter les questions/réponses
        if (question_answers) {
            for (let i = 0; i < question_answers.length; i++) {
                const qIndex = i + 1;
                bilanEntry[`q${qIndex}`] = question_answers[i].question;
                bilanEntry[`r${qIndex}`] = question_answers[i].reponse;
            }
        }

        await supabase.from('bilans').insert([bilanEntry]);

        res.json({
            success: true,
            stock_restant: stockActuel[stockKey],
            message: `Cadeau de type ${type_cadeau} attribué avec succès !`
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ REPORTING ============

// GET /api/reporting
app.get('/api/reporting', authenticateUser, async (req, res) => {
    try {
        let query = supabase
            .from('bilans')
            .select('*')
            .order('created_at', { ascending: false });

        const { tournee_id } = req.query;
        if (tournee_id) {
            query = query.eq('tournee_id', tournee_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ GESTION QUESTIONS ============

// GET /api/questions/all
app.get('/api/questions/all', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/questions
app.post('/api/questions', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('questions')
            .insert([req.body])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/questions/:id
app.put('/api/questions/:id', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('questions')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/questions/:id
app.delete('/api/questions/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('questions')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ GESTION D'ERREURS ============

// 404 - Page non trouvée
app.use((req, res) => {
    console.log('❌ 404:', req.url);
    if (req.url.endsWith('.html') || req.url === '/') {
        res.status(404).sendFile(path.join(publicPath, 'index.html'));
    } else {
        res.status(404).json({ error: 'Route non trouvée' });
    }
});

// Erreur serveur
app.use((err, req, res, next) => {
    console.error('💥 Erreur serveur:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ============ DÉMARRAGE ============
app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════');
    console.log(`🌊 Serveur Avène Thermal lancé !`);
    console.log(`📍 Local:   http://localhost:${PORT}`);
    console.log(`📍 Réseau:  http://0.0.0.0:${PORT}`);
    console.log(`📁 Public:  ${publicPath}`);
    console.log('═══════════════════════════════════════');
});
// ============ SESSIONS ============

// POST /api/sessions - Sauvegarder une session
app.post('/api/sessions', authenticateUser, async (req, res) => {
    try {
        const { token, user_id } = req.body;
        
        const { data, error } = await supabase
            .from('user_sessions')
            .upsert({
                user_id,
                token,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ ACTIVITÉ ============

// GET /api/activity - Logs d'activité
app.get('/api/activity', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/activity - Logger une activité
app.post('/api/activity', authenticateUser, async (req, res) => {
    try {
        const { action, details } = req.body;
        
        const { data, error } = await supabase
            .from('activity_logs')
            .insert([{
                user_id: req.user.id,
                action,
                details,
                ip_address: req.ip
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
