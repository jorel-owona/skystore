# 📖 Guide d'Utilisation & Manuel Opérationnel - SKYSTORE POS

Bienvenue dans le manuel d'utilisation officiel de **SKYSTORE POS**. Ce document vous guide pas-à-pas à travers toutes les fonctionnalités de l'application et récapitule les configurations manuelle à effectuer.

---

## 🚀 Part 1 : Guide d'Utilisation des Fonctionnalités

### 1. 🛒 Caisse & Terminal POS (Encaissement Ultra-Fast)
L'onglet **Caisse (POS)** est l'écran principal pour enregistrer les ventes au quotidien.

#### ⌨️ Raccourcis Clavier Caisse :
* **`F1`** : Sélectionner le mode de paiement **Espèces (Cash)**.
* **`F2`** : Sélectionner le mode de paiement **Orange Money** (permet de saisir l'ID de transaction).
* **`F3`** : Sélectionner le mode de paiement **Mobile Money** (permet de saisir l’ID de transaction).
* **`F4`** : Sélectionner le mode de paiement **Carte Bleue**.
* **`F9`** ou **`Ctrl + Entrée`** : Ouvrir l'aperçu du ticket et valider l'encaissement.
* **`Échap (Esc)`** : Annuler ou fermer la fenêtre d'aperçu ticket.

#### 📷 Scanner des Produits par Webcam :
1. Cliquez sur le bouton **Webcam** situé à droite de la barre de recherche.
2. Présentez le code-barres (EAN13/Code128) ou le QR Code devant la webcam du PC.
3. Le produit est automatiquement identifié et ajouté au panier avec un bip sonore.

#### 💬 Envoi de Reçus par WhatsApp :
1. Lors du choix du client en caisse, s'il possède un numéro de téléphone enregistré, un bouton **WhatsApp** apparaît dans la fenêtre d'aperçu.
2. Cliquez sur **WhatsApp** : l'application WhatsApp (ou Web) s'ouvre directement avec le reçu récapitulatif pré-rempli à destination du client.

---

### 2. 📊 Analytics & Tableau de Bord Financier
L'onglet **Analytics & Marges** vous permet d'analyser la rentabilité de votre commerce.

* **Filtres de période** : Choisissez entre *7 jours*, *30 jours* ou *Année en cours*.
* **Indicateurs clés (KPIs)** :
  * **Chiffre d'Affaires** : Recettes brutes cumulées sur la période.
  * **Marge Nette Réelle** : Calculée automatiquement comme *Ventes - Coût d'achat des produits vendus - Dépenses*.
  * **Dépenses Boutique** : Cumul des charges enregistrées dans l'onglet Dépenses.
  * **Panier Moyen** : Montant moyen dépensé par client lors d'une transaction.
* **Graphiques interactifs** :
  * Courbe d'évolution du CA vs Bénéfice brut quotidien.
  * Diagramme circulaire de répartition des modes de paiement (*Cash vs OM vs MoMo*).
  * Top 5 des produits les plus rentables.

---

### 3. 🛠️ Service Après-Vente (S.A.V) & Suivi IMEI
L'onglet **S.A.V & Réparations** permet de gérer les dépôts de matériel client (smartphones, ordinateurs, accessoires).

#### 📝 Enregistrer une Fiche S.A.V :
1. Cliquez sur **Nouvelle Fiche S.A.V**.
2. Renseignez le nom du client, le téléphone, le modèle d'appareil et son **numéro de série / IMEI**.
3. Indiquez la description de la panne, le tarif estimé et la date de livraison prévue.

#### 🔄 Suivi & Notification Client :
* Mettez à jour le statut du dossier via le menu déroulant : `Reçu` ➔ `En Diagnostic` ➔ `En Réparation` ➔ `Prêt` ➔ `Livré`.
* Cliquez sur l'icône **Message WhatsApp** pour envoyer une alerte automatique au client concernant l'avancement de son appareil.

---

### 4. 🎁 Programme de Fidélité Clients
* **Attribution automatique** : Pour chaque tranche de **1 000 FCFA** dépensée, le client gagne **1 point de fidélité** (ex: 25 000 FCFA = +25 points).
* **Consultation des points** : Les solde de points sont visibles dans l'onglet **Clients** et directement dans le sélecteur de client en caisse.

---

### 5. 🔐 Connexion & Gestion des Utilisateurs (PIN)
* Cliquez sur le badge d'utilisateur en haut à droite pour ouvrir l'écran de verrouillage.
* Choisissez votre nom dans la liste et tapez votre code PIN sur le pavé numérique.
* **Comptes créés par défaut** :
  * **Administrateur** : PIN `0000` (Accès complet).
  * **Caissier Principal** : PIN `1234` (Accès caisse et encaissement).

---

### 6. ☁️ Sauvegarde de la Base de Données
1. Dans la barre latérale gauche, cliquez sur le bouton **Sauvegarder BD**.
2. Sélectionnez le dossier de destination (par exemple un dossier synchronisé avec Google Drive ou OneDrive, ou une clé USB).
3. Cliquez sur **Enregistrer** : la base de données SQLite est exportée instantanément.

---

## 🛠️ Part 2 : Tâches Manuelle & Configurations à Effectuer

Voici les configurations recommandées à réaliser manuellement sur votre poste de travail :

### 1. 🖨️ Configuration de l'Imprimante Thermique
Si vous utilisez une imprimante thermique à ticket (ex: Xprinter XP-80C / POS-58) :
1. Connectez l'imprimante en USB à l'ordinateur et installez son pilote Windows.
2. Notez le nom exact de l'imprimante dans le panneau de configuration Windows (ex: `XP-80C`).
3. L'application enverra automatiquement les commandes d'impression ESC/POS à cette imprimante.

### 2. 🔐 Sécurisation des Mots de Passe / Codes PIN par Défaut
* Les codes PIN d'origine (`0000` et `1234`) doivent être modifiés en production.
* Pour ajouter ou modifier des utilisateurs, vous pouvez exécuter une requête SQL ou ajouter une interface de gestion des profils dans l'onglet Paramètres.

### 3. 📷 Autorisation d'Accès à la Webcam (Windows)
Lors du premier clic sur le bouton **Webcam** dans l'onglet Caisse :
* Windows peut demander l'autorisation d'accès à la caméra pour l'application Electron.
* Assurez-vous d'accepter la demande dans les paramètres de confidentialité de Windows (*Paramètres Windows > Confidentialité > Caméra*).

### 4. 📁 Automatisation de la Sauvegarde Cloud (Optionnel)
Pour automatiser la sauvegarde quotidienne sans intervention :
* Vous pouvez installer **Google Drive for Desktop** ou **OneDrive** sur l'ordinateur.
* Choisissez le dossier de synchronisation de Google Drive / OneDrive lors du clic sur le bouton **Sauvegarder BD**.

### 5. 📦 Génération du Fichier d'Installation (.EXE) & Publication en Ligne
Pour créer l'installateur Windows et le publier sur GitHub Releases pour l'auto-updater :
1. Ouvrez un terminal PowerShell dans le dossier du projet.
2. Définissez votre jeton GitHub :
   ```powershell
   $env:GH_TOKEN="votre_token_github"
   ```
3. Exécutez la commande :
   ```powershell
   npm run electron:publish
   ```
4. L'installateur `.exe` et le fichier `latest.yml` seront téléversés automatiquement sur votre page GitHub Releases.
