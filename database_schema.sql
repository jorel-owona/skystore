-- Schéma complet de la base de données SQLite pour SKYSTORE

-- Activer les clés étrangères (Foreign Keys)
PRAGMA foreign_keys = ON;

-- Table Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL UNIQUE
);

-- Table Produits
CREATE TABLE IF NOT EXISTS produits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    description TEXT,
    photo_path TEXT,
    prix_achat REAL NOT NULL,
    prix_vente REAL NOT NULL,
    quantite_stock INTEGER NOT NULL DEFAULT 0,
    categorie_id INTEGER,
    fournisseur TEXT,
    date_peremption TEXT,
    FOREIGN KEY(categorie_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Table Services (Main d'œuvre, Réparation, etc.)
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    description TEXT,
    cout_service REAL NOT NULL,
    categorie_id INTEGER,
    FOREIGN KEY(categorie_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Table Clients
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    telephone TEXT NOT NULL UNIQUE,
    dette_actuelle REAL NOT NULL DEFAULT 0.0
);

-- Table Ventes (Factures)
CREATE TABLE IF NOT EXISTS ventes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    date_vente TEXT NOT NULL, -- Format ISO8601 recommandé
    moyen_paiement TEXT CHECK(moyen_paiement IN ('Cash', 'Orange Money', 'Mobile Money')) NOT NULL,
    transaction_id TEXT, -- ID de transaction optionnel (utile pour OM ou MoMo)
    statut_paiement TEXT CHECK(statut_paiement IN ('Payé', 'Impayé')) NOT NULL,
    total_facture REAL NOT NULL,
    statut_facture TEXT CHECK(statut_facture IN ('Valide', 'Supprimée')) NOT NULL DEFAULT 'Valide',
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Table Détails des Ventes (Liaison facture <=> produits/services)
CREATE TABLE IF NOT EXISTS details_ventes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vente_id INTEGER NOT NULL,
    type_item TEXT CHECK(type_item IN ('Produit', 'Service')) NOT NULL,
    item_id INTEGER NOT NULL,
    quantite INTEGER NOT NULL,
    prix_unitaire_vendu REAL NOT NULL,
    FOREIGN KEY(vente_id) REFERENCES ventes(id) ON DELETE CASCADE
);

-- Table Dépenses (Charges de la boutique)
CREATE TABLE IF NOT EXISTS depenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objet TEXT NOT NULL,
    raison TEXT NOT NULL,
    categorie_depense TEXT NOT NULL,
    somme REAL NOT NULL,
    date_depense TEXT NOT NULL -- Format ISO8601
);

-- Table Sessions Caisses (Suivi d'ouverture et de fermeture de caisse)
CREATE TABLE IF NOT EXISTS sessions_caisses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_ouverture TEXT NOT NULL,
    date_fermeture TEXT,
    fond_caisse_initial REAL NOT NULL,
    recette_attendue REAL,
    recette_reelle REAL
);

-- Table Journal d'Audit (Mouvements de stocks, modifications sensibles)
CREATE TABLE IF NOT EXISTS journal_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_evenement TEXT NOT NULL,
    type_evenement TEXT NOT NULL, -- ex: 'STOCK_IN', 'PRICE_CHANGE', 'SALE_CANCEL'
    details TEXT NOT NULL
);

-- =====================================================================
-- Insertion de données de test (Mock Data) pour un démarrage rapide
-- =====================================================================

INSERT INTO categories (nom) VALUES ('Stockage'), ('Connectique'), ('Périphériques'), ('Services Bureau');

INSERT INTO produits (nom, prix_achat, prix_vente, quantite_stock, categorie_id, fournisseur) 
VALUES 
('Clé USB 64Go SanDisk', 10.00, 15.00, 45, 1, 'Fournisseur A'),
('Câble HDMI 2m Or', 5.00, 8.50, 120, 2, 'Tech Pro'),
('Souris Sans Fil Logitech', 14.00, 22.00, 15, 3, 'GrosBill');

INSERT INTO services (nom, cout_service, categorie_id)
VALUES ('Photocopie A4', 0.50, 4), ('Réparation Windows', 25.00, 4);

INSERT INTO clients (nom, telephone) VALUES ('Client En Passant', '0000000000');
