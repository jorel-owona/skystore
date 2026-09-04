# 📘 GUIDE DES FONCTIONNALITÉS & ARCHITECTURE DU CODE — SKYSTORE POS

Ce document répertorie l'ensemble des fonctionnalités de l'application **SKYSTORE**, leur fonctionnement, les restrictions d'accès par rôle et les fichiers sources exacts qui les gèrent.

---

## 🏛️ 1. Architecture Générale du Projet

```
SKYSTORE/
├── electron/
│   ├── main.js             # Processus principal Electron (Fenêtres, IPC, Impression brute ESC/POS, Sauvegarde BD)
│   ├── database.js         # Initialisation SQLite, Tables, Migrations et Utilisateurs par défaut
│   ├── preload.js          # Pont sécurisé contextBridge (Expose window.api au Frontend)
│   └── splash.html         # Écran de chargement au démarrage
├── src/
│   ├── App.jsx             # Composant racine, Navigation, Filtrage des rôles, Thème, Modal Boutique
│   ├── index.css           # Thème Liquid Glass 3D, animations, styles d'impression
│   ├── components/
│   │   ├── LoginModal.jsx  # Clavier virtuel PIN & Connexion multi-utilisateurs
│   │   ├── Toast.jsx       # Notifications flottantes Liquid 3D
│   │   ├── Barcode.jsx     # Rendu SVG du code-barres Code128
│   │   └── BarcodeScannerModal.jsx # Scanner par webcam
│   ├── tabs/
│   │   ├── Caisse.jsx      # Point de Vente (POS), Panier, Remises, Scanner, Fidélité, Raccourcis F1-F9
│   │   ├── Vente.jsx       # Ouverture/Clôture de Caisse, Fond de caisse, Rapport Z
│   │   ├── Factures.jsx    # Historique des ventes, Duplicatas, Annulation avec restockage, WhatsApp
│   │   ├── Analytics.jsx   # Marges réelles, Chiffre d'affaires, Bénéfices nets, Top ventes
│   │   ├── Produits.jsx    # Catalogue articles, Gestion stocks, Alertes réassort, Photos
│   │   ├── Services.jsx    # Prestations de services (non stockables)
│   │   ├── Inventaire.jsx  # État global des stocks et valorisation financière
│   │   ├── Depenses.jsx    # Sorties de caisse et charges d'exploitation
│   │   ├── Clients.jsx     # Carnet clients, Gestion des dettes, Points fidélité
│   │   ├── Sav.jsx         # Suivi des réparations et tickets S.A.V
│   │   └── Journal.jsx     # Journal d'audit et traçabilité des opérations
│   └── utils/
│       ├── db.js           # Wrapper d'exécution SQL (window.api.dbQuery)
│       └── sounds.js       # Effets sonores Web Audio API (Beep, Caisse, Clic, Erreur)
└── package.json
```

---

## 👥 2. Matrice des Droits et Restrictions par Rôle

| Fonctionnalité / Onglet | CAISSIER | GÉRANT | ADMIN | Fichier source principal |
|---|:---:|:---:|:---:|---|
| **Caisse (POS)** | ✅ | ✅ | ✅ | [`src/tabs/Caisse.jsx`](file:///src/tabs/Caisse.jsx) |
| **S.A.V & Réparations** | ✅ | ✅ | ✅ | [`src/tabs/Sav.jsx`](file:///src/tabs/Sav.jsx) |
| **Gestion des Clients & Dettes** | ✅ | ✅ | ✅ | [`src/tabs/Clients.jsx`](file:///src/tabs/Clients.jsx) |
| **Consultation / Réimpression Factures** | ✅ | ✅ | ✅ | [`src/tabs/Factures.jsx`](file:///src/tabs/Factures.jsx) |
| **Annulation de Facture & Restitution Stock** | ❌ | ❌ | ✅ | [`src/tabs/Factures.jsx`](file:///src/tabs/Factures.jsx#L40) |
| **Sessions de Caisse & Rapport Z** | ❌ | ✅ | ✅ | [`src/tabs/Vente.jsx`](file:///src/tabs/Vente.jsx) |
| **Gestion Produits & Prix d'achat** | ❌ | ✅ | ✅ | [`src/tabs/Produits.jsx`](file:///src/tabs/Produits.jsx) |
| **Gestion des Services** | ❌ | ✅ | ✅ | [`src/tabs/Services.jsx`](file:///src/tabs/Services.jsx) |
| **Inventaire & Valorisation Stock** | ❌ | ✅ | ✅ | [`src/tabs/Inventaire.jsx`](file:///src/tabs/Inventaire.jsx) |
| **Enregistrement des Dépenses** | ❌ | ✅ | ✅ | [`src/tabs/Depenses.jsx`](file:///src/tabs/Depenses.jsx) |
| **Analytics, Marges Réelles & Bénéfices** | ❌ | ❌ | ✅ | [`src/tabs/Analytics.jsx`](file:///src/tabs/Analytics.jsx) |
| **Journal d'Audit & Traçabilité** | ❌ | ❌ | ✅ | [`src/tabs/Journal.jsx`](file:///src/tabs/Journal.jsx) |
| **Paramètres Boutique (Nom & Logo)** | ❌ | ❌ | ✅ | [`src/App.jsx`](file:///src/App.jsx#L310) |
| **Sauvegarde Physique de la Base SQLite** | ❌ | ❌ | ✅ | [`src/App.jsx`](file:///src/App.jsx#L101), [`electron/main.js`](file:///electron/main.js#L653) |

---

## 🔍 3. Répertoire Détaillé des Fonctionnalités & Code Source

### 🛒 A. Point de Vente & Caisse (POS)
- **Fichier** : [`src/tabs/Caisse.jsx`](file:///src/tabs/Caisse.jsx)
- **Raccourcis Clavier** :
  - `F1` : Paiement Espèces (Cash)
  - `F2` : Orange Money
  - `F3` : Mobile Money (MTN)
  - `F4` : Carte Bancaire
  - `F9` ou `Ctrl + Entrée` : Valider & Encaisser
  - `Echap` : Fermer aperçu / scanner
- **Fonctionnalités clés** :
  - Détection automatique et scan de codes-barres (`handleScanBarcode`)
  - Gestion du panier multi-articles (Produits physiques avec contrôle de stock + Services sans stock)
  - Négociation / Modification directe du prix de vente (`editingPriceId`)
  - Attribution automatique des points de fidélité au client sélectionné
  - Envoi direct du ticket en impression thermique ESC/POS 80mm
  - Partage récapitulatif par lien WhatsApp direct

### ⚙️ B. Paramètres de la Boutique (Nom & Logo)
- **Fichiers** : [`src/App.jsx`](file:///src/App.jsx#L108-L148), [`src/tabs/Caisse.jsx`](file:///src/tabs/Caisse.jsx#L55)
- **Fonctionnement** :
  - Le nom de la boutique est sauvegardé dans `localStorage.getItem('skystore_shop_name')`.
  - Il s'applique automatiquement à la barre latérale, à l'en-tête, aux tickets de caisse et aux rapports Z.
  - Possibilité d'importer une image de logo personnalisée (stockée en base64 dans `localStorage.getItem('skystore_logo_custom')`) ou d'activer l'un des 2 logos 3D Liquid Glass pré-intégrés.

### 🧾 C. Gestion & Annulation des Factures
- **Fichier** : [`src/tabs/Factures.jsx`](file:///src/tabs/Factures.jsx)
- **Fonctionnement** :
  - Consultation de toutes les ventes passées avec recherche en direct.
  - Réimpression de duplicata de ticket thermique.
  - **Annulation sécurisée (Admin uniquement)** : Rétablit instantanément les quantités vendues dans la table `produits`, passe le statut de la vente à `Supprimée` et enregistre l'action détaillée dans le Journal d'Audit.

### 📊 D. Tableau de Bord Financier & Analytics
- **Fichier** : [`src/tabs/Analytics.jsx`](file:///src/tabs/Analytics.jsx)
- **Calculs intégrés** :
  - **Marge brute** = `Chiffre d'Affaires - Coût d'Achat Réel des Produits Vendus`
  - **Bénéfice net** = `Marge Brute - Total des Dépenses Opérationnelles`
  - Filtres temporels : 7 jours, 30 jours, 1 an.
  - Répartition par moyen de paiement et Top 5 des articles les plus vendus.

### 💰 E. Clôture de Caisse & Rapport Z
- **Fichier** : [`src/tabs/Vente.jsx`](file:///src/tabs/Vente.jsx)
- **Fonctionnement** :
  - Ouverture de session avec saisie du fond de caisse initial.
  - Clôture de session avec calcul automatique de l'écart de caisse (`Recette réelle - Recette attendue`).
  - Impression matérielle automatique du ticket **Rapport Z** avec découpe du papier.

### 📦 F. Gestion des Stocks, Produits & Services
- **Fichiers** : [`src/tabs/Produits.jsx`](file:///src/tabs/Produits.jsx), [`src/tabs/Services.jsx`](file:///src/tabs/Services.jsx), [`src/tabs/Inventaire.jsx`](file:///src/tabs/Inventaire.jsx)
- **Fonctionnement** :
  - Gestion des fiches articles avec images, codes-barres et seuils d'alerte.
  - Valorisation totale du stock au prix d'achat et au prix de vente attendu.
  - Suivi des alertes de rupture.

### 🛠️ G. Module S.A.V & Réparations
- **Fichier** : [`src/tabs/Sav.jsx`](file:///src/tabs/Sav.jsx)
- **Fonctionnement** :
  - Création de tickets de prise en charge pour les appareils clients en panne.
  - Suivi des étapes de traitement : *Reçu ➔ En Diagnostic ➔ En Réparation ➔ Prêt ➔ Livré*.
  - Génération de reçu de dépôt d'appareil.

### 🛡️ H. Journal d'Audit & Sécurité
- **Fichier** : [`src/tabs/Journal.jsx`](file:///src/tabs/Journal.jsx), [`electron/database.js`](file:///electron/database.js#L84)
- **Fonctionnement** :
  - Historique immuable de toutes les actions sensibles (ventes, annulations, ouvertures/fermetures de session, dépenses, réajustements de stock).

---

## 🖨️ 4. Système d'Impression Thermique (ESC/POS)

- **Fichier principal** : [`electron/main.js`](file:///electron/main.js#L415-L636)
- **Fonctionnement technique** :
  1. Génération d'un buffer binaire de commandes brutes ESC/POS :
     - `0x1B 0x40` : Initialisation
     - `0x1B 0x70` : Impulsion ouverture tiroir-caisse
     - `0x1D 0x21` : Mise à l'échelle des polices
     - `0x1D 0x6B 0x49` : Impression du Code-barres CODE128
     - `0x1D 0x56 0x42` : Coupure automatique du papier
  2. Envoi via script PowerShell injecté dans le Spooler Windows (`RawPrintHelper` P/Invoke `winspool.drv`).
  3. Fallback automatique sur `window.print()` avec styles CSS `@media print` si l'imprimante thermique n'est pas connectée.

---

## 🗄️ 5. Base de Données SQLite

- **Emplacement du fichier** : `%APPDATA%/skystore/skystore.sqlite`
- **Initialisation & Schéma** : [`electron/database.js`](file:///electron/database.js)
- **Sauvegarde manuelle** : Menu latéral ➔ *Sauvegarder BD* (Export `.sqlite` horodaté via boîte de dialogue native).

---
*Document généré pour le projet SKYSTORE POS.*
