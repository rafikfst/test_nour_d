// server.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://pyqjgffygesrlfyfagms.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_vltwOvN6j1ThYSos43EV9A_z7la0IFh';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware d'authentification
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Token invalide' });
    }

    req.user = user;
    next();
};

// Middleware de vérification de rôle admin
const requireAdmin = async (req, res, next) => {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé. Admin requis.' });
    }

    next();
};

// ============ ROUTES API ============

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ AUTHENTIFICATION ============

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, nom } = req.body;

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;

        // Mettre à jour le profil
        if (authData.user) {
            await supabase
                .from('profiles')
                .update({ nom })
                .eq('id', authData.user.id);
        }

        res.json({
            success: true,
            user: authData.user,
            message: 'Inscription réussie. Vérifiez votre email.'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Récupérer le profil
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        res.json({
            success: true,
            session: data.session,
            profile: profile
        });
    } catch (error) {
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

// ============ GESTION DES UTILISATEURS ============

// GET /api/users
app.get('/api/users', authenticateUser, requireAdmin, async (req, res) => {
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
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ GESTION DES TOURNÉES ============

// GET /api/tournees
app.get('/api/tournees', authenticateUser, async (req, res) => {
    try {
        let query = supabase.from('tournees').select('*, pharmacies(*)');
        
        // Si l'utilisateur n'est pas admin, filtrer par sa région
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, region')
            .eq('id', req.user.id)
            .single();

        if (profile.role === 'agent' && profile.region) {
            query = query.eq('region', profile.region);
        }

        const { data, error } = await query.order('date_debut', { ascending: false });
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
        const { region, date_debut, date_fin, stock_initial, stock_actuel } = req.body;
        
        const { data, error } = await supabase
            .from('tournees')
            .update({ region, date_debut, date_fin, stock_initial, stock_actuel })
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

// ============ GESTION DES PHARMACIES ============

// GET /api/pharmacies
app.get('/api/pharmacies', authenticateUser, async (req, res) => {
    try {
        let query = supabase
            .from('pharmacies')
            .select('*, agents(*)');

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

// ============ GESTION DES AGENTS ============

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

// GET /api/questions?difficulte=...
app.get('/api/questions', authenticateUser, async (req, res) => {
    try {
        const { difficulte, agent_id, pharmacy_id } = req.query;

        // Récupérer les questions déjà utilisées par cet agent dans cette session
        let questionsUsed = [];
        if (agent_id && pharmacy_id) {
            const { data: session } = await supabase
                .from('game_sessions')
                .select('questions_used')
                .eq('agent_id', agent_id)
                .eq('pharmacy_id', pharmacy_id)
                .eq('statut', 'actif')
                .single();

            if (session) {
                questionsUsed = session.questions_used || [];
            }
        }

        // Récupérer une question aléatoire non utilisée
        let query = supabase
            .from('questions')
            .select('*')
            .eq('difficulte', difficulte)
            .eq('actif', true);

        if (questionsUsed.length > 0) {
            query = query.not('id', 'in', `(${questionsUsed.join(',')})`);
        }

        const { data: questions, error } = await query;

        if (error) throw error;
        if (!questions || questions.length === 0) {
            return res.status(404).json({ error: 'Aucune question disponible' });
        }

        // Sélectionner une question aléatoire
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

        res.json(randomQuestion);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/game/init
app.post('/api/game/init', authenticateUser, async (req, res) => {
    try {
        const { agent_id, pharmacy_id } = req.body;

        // Créer une nouvelle session de jeu
        const { data, error } = await supabase
            .from('game_sessions')
            .insert([{
                agent_id,
                pharmacy_id,
                questions_used: [],
                niveau_actuel: 1,
                statut: 'actif'
            }])
            .select()
            .single();

        if (error) throw error;

        // Mettre à jour le statut de l'agent
        await supabase
            .from('agents')
            .update({ statut_jeu: 'En cours' })
            .eq('id', agent_id);

        res.json(data);
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

        // Vérifier la réponse
        const { data: question, error: questionError } = await supabase
            .from('questions')
            .select('*')
            .eq('id', question_id)
            .single();

        if (questionError) throw questionError;

        const isCorrect = JSON.stringify(reponse) === JSON.stringify(question.blocs_corrects);

        // Mettre à jour la session de jeu
        const { data: session } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('agent_id', agent_id)
            .eq('pharmacy_id', pharmacy_id)
            .eq('statut', 'actif')
            .single();

        if (session) {
            const updatedQuestions = [...session.questions_used, question_id];
            const newNiveau = isCorrect ? niveau_actuel + 1 : niveau_actuel;

            await supabase
                .from('game_sessions')
                .update({
                    questions_used: updatedQuestions,
                    niveau_actuel: newNiveau,
                    statut: isCorrect ? 'actif' : 'termine'
                })
                .eq('id', session.id);
        }

        // Si perdu, enregistrer dans le bilan
        if (!isCorrect) {
            await supabase.from('agents')
                .update({ statut_jeu: 'Perdu' })
                .eq('id', agent_id);

            const { data: agent } = await supabase
                .from('agents')
                .select('nom, pharmacies(nom)')
                .eq('id', agent_id)
                .single();

            await supabase.from('bilans').insert([{
                tournee_id,
                nom_pharmacie: agent.pharmacies.nom,
                nom_agent: agent.nom,
                q1: question.enonce,
                r1: reponse.join(', '),
                cadeau_description: 'Perdu'
            }]);
        }

        // Récupérer les infos du tournée pour la vérification de stock
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
            pharmacy_id,
            tournee_id,
            type_cadeau,
            question_answers
        } = req.body;

        // Mapping des types de cadeaux
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

        // Vérifier et décrémenter le stock
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

        // Terminer la session de jeu
        await supabase
            .from('game_sessions')
            .update({ statut: 'termine' })
            .eq('agent_id', agent_id)
            .eq('pharmacy_id', pharmacy_id)
            .eq('statut', 'actif');

        // Enregistrer dans le bilan
        const { data: agent } = await supabase
            .from('agents')
            .select('nom, pharmacies(nom)')
            .eq('id', agent_id)
            .single();

        const bilanEntry = {
            tournee_id,
            nom_pharmacie: agent.pharmacies.nom,
            nom_agent: agent.nom,
            cadeau_assigne: true,
            cadeau_description: statutMapping[type_cadeau]
        };

        // Ajouter les questions/réponses
        for (let i = 0; i < question_answers.length; i++) {
            const qIndex = i + 1;
            bilanEntry[`q${qIndex}`] = question_answers[i].question;
            bilanEntry[`r${qIndex}`] = question_answers[i].reponse;
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

        const { tournee_id, region } = req.query;
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

// DELETE /api/reporting/:id
app.delete('/api/reporting/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('bilans')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============ QUESTIONS CRUD ============

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

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🌊 Serveur Avène Thermal lancé sur http://localhost:${PORT}`);
    console.log(`💧 Environnement: ${process.env.NODE_ENV || 'development'}`);
});