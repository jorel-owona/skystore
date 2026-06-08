const Database = require('better-sqlite3');
const path = require('path');

function initDB(dbPath) {
  // Ouvre la base de données de manière synchrone
  const db = new Database(dbPath, { verbose: console.log });

  // Création des tables de manière synchrone
  db.exec(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS produits (
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
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      cout_service REAL NOT NULL,
      categorie_id INTEGER,
      FOREIGN KEY(categorie_id) REFERENCES categories(id) ON DELETE SET NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT NOT NULL UNIQUE,
      dette_actuelle REAL NOT NULL DEFAULT 0.0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      date_vente TEXT NOT NULL,
      moyen_paiement TEXT CHECK(moyen_paiement IN ('Cash', 'Orange Money', 'Mobile Money', 'Carte')) NOT NULL DEFAULT 'Cash',
      transaction_id TEXT,
      statut_paiement TEXT CHECK(statut_paiement IN ('Payé', 'Impayé')) NOT NULL DEFAULT 'Payé',
      total_facture REAL NOT NULL,
      statut_facture TEXT CHECK(statut_facture IN ('Valide', 'Supprimée', 'Annule')) NOT NULL DEFAULT 'Valide',
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS details_ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vente_id INTEGER NOT NULL,
      type_item TEXT CHECK(type_item IN ('Produit', 'Service')) NOT NULL,
      item_id INTEGER NOT NULL,
      quantite INTEGER NOT NULL,
      prix_unitaire_vendu REAL NOT NULL,
      FOREIGN KEY(vente_id) REFERENCES ventes(id) ON DELETE CASCADE
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS depenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objet TEXT NOT NULL,
      raison TEXT NOT NULL,
      categorie_depense TEXT NOT NULL,
      somme REAL NOT NULL,
      date_depense TEXT NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sessions_caisses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_ouverture TEXT NOT NULL,
      date_fermeture TEXT,
      fond_caisse_initial REAL NOT NULL,
      recette_attendue REAL,
      recette_reelle REAL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS journal_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_evenement TEXT NOT NULL,
      type_evenement TEXT NOT NULL,
      details TEXT NOT NULL,
      full_data TEXT
  )`);

  // Migration automatique : ajoute full_data si l'utilisateur a une ancienne BD
  try {
    db.exec(`ALTER TABLE journal_audit ADD COLUMN full_data TEXT`);
  } catch (err) {
    // Si la colonne existe déjà, better-sqlite3 lèvera une erreur, on l'ignore proprement
  }

  // Migrations pour la table ventes
  try {
    db.exec(`ALTER TABLE ventes ADD COLUMN moyen_paiement TEXT CHECK(moyen_paiement IN ('Cash', 'Orange Money', 'Mobile Money', 'Carte')) NOT NULL DEFAULT 'Cash'`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE ventes ADD COLUMN transaction_id TEXT`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE ventes ADD COLUMN statut_paiement TEXT CHECK(statut_paiement IN ('Payé', 'Impayé')) NOT NULL DEFAULT 'Payé'`);
  } catch (err) {}

  return db;
}

module.exports = initDB;