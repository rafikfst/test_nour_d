
-- Active UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des profils utilisateurs
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(255),
    role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('admin', 'superviseur', 'agent')),
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table Tournées (Stock Management)
CREATE TABLE tournees (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    stock_initial JSONB NOT NULL DEFAULT '{"type1": 50, "type2": 30, "type3": 10, "superlot": 2}',
    stock_actuel JSONB NOT NULL DEFAULT '{"type1": 50, "type2": 30, "type3": 10, "superlot": 2}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table Pharmacies
CREATE TABLE pharmacies (
    id SERIAL PRIMARY KEY,
    tournee_id INT REFERENCES tournees(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('pharmacie', 'para', 'fournisseur')),
    adresse TEXT,
    telephone VARCHAR(50),
    email VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    est_visitee BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table Agents
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(50),
    statut_jeu VARCHAR(50) DEFAULT 'Non Joué' CHECK (statut_jeu IN ('Non Joué', 'Perdu', 'Gagné Type 1', 'Gagné Type 2', 'Gagné Type 3', 'Gagné Super Lot')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table Questions
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    difficulte VARCHAR(10) CHECK (difficulte IN ('75%', '50%', '25%', '1%')),
    enonce TEXT NOT NULL,
    blocs_corrects TEXT[] NOT NULL,
    blocs_pieges TEXT[] NOT NULL,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table Sessions de Jeu (track used questions)
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    agent_id INT REFERENCES agents(id) ON DELETE CASCADE,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE CASCADE,
    questions_used INT[] DEFAULT '{}',
    niveau_actuel INT DEFAULT 1,
    statut VARCHAR(50) DEFAULT 'actif' CHECK (statut IN ('actif', 'termine', 'abandonne')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table Bilan (Reporting)
CREATE TABLE bilans (
    id SERIAL PRIMARY KEY,
    tournee_id INT REFERENCES tournees(id),
    nom_pharmacie VARCHAR(255),
    nom_agent VARCHAR(255),
    q1 TEXT,
    r1 TEXT,
    q2 TEXT,
    r2 TEXT,
    q3 TEXT,
    r3 TEXT,
    q4 TEXT,
    r4 TEXT,
    cadeau_assigne BOOLEAN DEFAULT FALSE,
    cadeau_description TEXT DEFAULT 'Aucun',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX idx_pharmacies_tournee ON pharmacies(tournee_id);
CREATE INDEX idx_agents_pharmacy ON agents(pharmacy_id);
CREATE INDEX idx_bilans_tournee ON bilans(tournee_id);
CREATE INDEX idx_questions_difficulte ON questions(difficulte) WHERE actif = TRUE;
CREATE INDEX idx_game_sessions_agent ON game_sessions(agent_id) WHERE statut = 'actif';

-- Trigger pour mettre à jour le champ updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger à toutes les tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournees_updated_at BEFORE UPDATE ON tournees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON pharmacies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour créer le profil automatiquement après l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'agent');
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournees ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilans ENABLE ROW LEVEL SECURITY;

-- Policies pour les profils
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
));

-- Policies pour les tournées
CREATE POLICY "Authenticated users can view tournees"
ON tournees FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Admin and superviseur can insert tournees"
ON tournees FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superviseur')
));

CREATE POLICY "Admin and superviseur can update tournees"
ON tournees FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superviseur')
));

CREATE POLICY "Admin can delete tournees"
ON tournees FOR DELETE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
));

-- Insérer des questions de test
INSERT INTO questions (difficulte, enonce, blocs_corrects, blocs_pieges) VALUES
('75%', 'Complétez : Eau Thermale Avène est reconnue pour ses propriétés...', 
 ARRAY['apaisantes', 'anti-irritantes'],
 ARRAY['exfoliantes', 'astringentes', 'déshydratantes']),
('50%', 'Les actifs principaux des produits solaires Avène sont...',
 ARRAY['système filtrant', 'photostable'],
 ARRAY['huiles essentielles', 'parfums synthétiques', 'colorants']),
('25%', 'La gamme antirougeurs Avène contient...',
 ARRAY['TRP-Regulin', 'Dextran Sulfate'],
 ARRAY['Acide Hyaluronique', 'Rétinol pur', 'Vitamine C']),
('1%', 'Le brevet Avène pour la protection cellulaire est...',
 ARRAY['brevet', 'Eau Thermale', 'microbiome'],
 ARRAY['nanoparticules', 'acides alpha-hydroxylés', 'silicone']);
