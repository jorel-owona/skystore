const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Désactivation de l'accélération matérielle et de la Sandbox pour compatibilité avec les écrans tactiles industriels et processeurs anciens (Core i3-3110M)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Logger global résistant pour capturer toutes les exceptions
let logPath = null;
function logError(err) {
  try {
    if (!logPath) {
      try {
        const userDataPath = app.getPath('userData');
        logPath = path.join(userDataPath, 'error.log');
      } catch (e) {
        logPath = path.join(app.getAppPath(), 'error_startup.log');
      }
    }
    const time = new Date().toISOString();
    const msg = `[${time}] ${err.stack || err}\n`;
    fs.appendFileSync(logPath, msg, 'utf8');
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  logError(err);
  try {
    dialog.showErrorBox(
      'Erreur Critique de Démarrage',
      `L'application n'a pas pu démarrer correctement.\n\nDétail de l'erreur :\n${err.message}\n\nUn journal d'erreur a été créé dans :\n${logPath || 'dossier de l\'application'}`
    );
  } catch (e) {}
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logError(reason);
});

// Importations des fichiers locaux susceptibles d'échouer (ex: better-sqlite3 natif)
const initDB = require('./database');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let splashWindow;
let db;



// --- Utilitaire : ouvre la BD avec protection contre la corruption ---
// Si la BD est inaccessible (fichier verrouillé, corrompu), elle est sauvegardée
// AVANT toute suppression, et l'utilisateur est averti via une dialog.
function openDatabase(dbPath) {
  try {
    // Tentative normale d'ouverture
    const instance = initDB(dbPath);
    return instance;
  } catch (err) {
    console.error('[DB] Impossible d\'ouvrir la base de données :', err.message);

    // Chemin de sauvegarde horodaté — les données sont PRÉSERVÉES
    const backupPath = dbPath + '.backup_' + new Date().toISOString().replace(/[:.]/g, '-');

    try {
      // Copier d'abord (ne pas déplacer) pour être sûr de ne rien perdre
      fs.copyFileSync(dbPath, backupPath);
      console.log('[DB] Sauvegarde créée :', backupPath);
    } catch (copyErr) {
      console.warn('[DB] Impossible de sauvegarder :', copyErr.message);
    }

    // Supprimer le fichier endommagé et recréer une BD propre
    try { fs.unlinkSync(dbPath); } catch (e) {}

    // Informer l'utilisateur via une boîte de dialogue (après que app soit prêt)
    app.whenReady().then(() => {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Base de données - Récupération',
        message: 'La base de données était inaccessible et a été réinitialisée.',
        detail:
          'Vos données précédentes ont été sauvegardées dans le fichier suivant :\n\n' +
          backupPath +
          '\n\nVous pouvez contacter le support pour tenter une récupération.',
        buttons: ['OK'],
      });
    });

    return initDB(dbPath);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    icon: path.join(__dirname, '../asset/logoSkyStore.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // FIX Bug 2 : s'assurer que les raccourcis clavier et les events input ne sont jamais bloqués
      backgroundThrottling: false,
    },
    autoHideMenuBar: true,
  });

  // FIX Bug 2 : Empêcher Electron de capturer le focus clavier sur des éléments non-input
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Laisser passer tous les événements clavier vers la page web
  });

  splashWindow = new BrowserWindow({
    width: 450,
    height: 450,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    // CORRECTION : Chemin absolu et extension .ico
    icon: path.join(__dirname, '../asset/logoSkyStore.ico'),
    webPreferences: {
      sandbox: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    // Lancer la vérification des mises à jour dès que l'application démarre
    if (app.isPackaged) {
      autoUpdater.logger = console;
      autoUpdater.checkForUpdatesAndNotify();
    }

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      mainWindow.show();
      if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
      }
    }, 1500);
  });
}

app.whenReady().then(() => {
  // C'est ICI qu'on gère le dossier de manière sécurisée après l'initialisation d'Electron
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // FIX Bug 3 : utilise openDatabase() avec vérification d'intégrité
  db = openDatabase(path.join(userDataPath, 'skystore.sqlite'));

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- Base de données IPC (better-sqlite3) ---
ipcMain.handle('db:query', async (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(params);
    } else {
      const info = stmt.run(params);
      return {
        id: info.lastInsertRowid,
        changes: info.changes
      };
    }
  } catch (error) {
    console.error("Erreur d'exécution SQL:", error);
    throw error;
  }
});

// --- Impression silencieuse via une fenêtre dédiée (FIX Bug 1 : coupon trop petit) ---
ipcMain.handle('print:silent', async (event, printerName) => {
  const win = mainWindow;
  if (!win) return Promise.reject('Fenêtre principale non trouvée');

  // Récupérer le HTML complet de la page principale
  const pageUrl = win.webContents.getURL();

  return new Promise((resolve, reject) => {
    // Créer une fenêtre d'impression cachée de largeur 80mm (302px à 96dpi)
    const printWin = new BrowserWindow({
      width: 320,
      height: 1200,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
        backgroundThrottling: false,
      }
    });

    // Charger la même URL que la fenêtre principale
    printWin.loadURL(pageUrl);

    printWin.webContents.once('did-finish-load', () => {
      const printOptions = {
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: { width: 80000, height: 297000 }, // 80mm x 297mm en microns
        scaleFactor: 100,
      };

      if (printerName) {
        printOptions.deviceName = printerName;
      }

      // Délai pour s'assurer que React a rendu le ticket dans cette fenêtre
      setTimeout(() => {
        printWin.webContents.print(printOptions, (success, failureReason) => {
          printWin.close();
          if (!success) reject(failureReason || 'Échec impression');
          else resolve('Impression réussie');
        });
      }, 800);
    });

    printWin.webContents.on('did-fail-load', (e, code, desc) => {
      printWin.close();
      reject(`Échec chargement page d'impression: ${desc}`);
    });
  });
});

// --- Récupérer la liste des imprimantes système ---
ipcMain.handle('print:get-printers', async () => {
  const win = mainWindow;
  if (!win) return [];
  return await win.webContents.getPrintersAsync();
});

// --- Impression Ticket de caisse brute (ESC/POS via PowerShell) ---
ipcMain.handle('print:raw', async (event, printerName, rawDataHex) => {
  try {
    const rawData = Buffer.from(rawDataHex, 'hex');
    const tempBinFile = path.join(app.getPath('temp'), 'skystore_print.bin');
    fs.writeFileSync(tempBinFile, rawData);

    const tempPs1File = path.join(app.getPath('temp'), 'skystore_print.ps1');

    const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
using System.IO;

public class RawPrintHelper {
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;
        di.pDocName = "SKYSTORE Receipt";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    byte[] bytes = File.ReadAllBytes(szFileName);
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    EndPagePrinter(hPrinter);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@
if (-not ([Ref].Assembly.GetType('RawPrintHelper'))) {
    Add-Type -TypeDefinition $code
}
[RawPrintHelper]::SendFileToPrinter('${printerName}', '${tempBinFile.replace(/\\/g, '\\\\')}')
`;

    fs.writeFileSync(tempPs1File, psScript, 'utf8');

    return new Promise((resolve, reject) => {
      exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempPs1File}"`, (err, stdout, stderr) => {
        try { fs.unlinkSync(tempPs1File); } catch (e) { }

        if (err) {
          reject(err.message);
        } else if (stdout.includes('False')) {
          reject('Failed to print to ' + printerName);
        } else {
          resolve('Success');
        }
      });
    });
  } catch (error) {
    return Promise.reject(error.message);
  }
});

// --- Stockage des Images Produits ---
ipcMain.handle('file:saveProductImage', (event, sourcePath, fileName) => {
  const userDataPath = app.getPath('userData');
  const imagesDir = path.join(userDataPath, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  const destPath = path.join(imagesDir, fileName);
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
});

// --- Lecture des Images locales en Base64 ---
ipcMain.handle('file:readImage', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).substring(1);
    return `data:image/${ext || 'png'};base64,${data.toString('base64')}`;
  } catch (error) {
    console.error("Erreur lecture image:", error);
    return null;
  }
});

// --- Gestion des événements de l'Auto-Updater ---
autoUpdater.on('checking-for-update', () => {
  console.log('Vérification des mises à jour en cours...');
});
autoUpdater.on('update-available', (info) => {
  console.log('Mise à jour disponible:', info.version);
});
autoUpdater.on('update-not-available', (info) => {
  console.log('Aucune mise à jour disponible.');
});
autoUpdater.on('error', (err) => {
  console.error('Erreur lors de la vérification de mise à jour:', err);
});
autoUpdater.on('download-progress', (progressObj) => {
  console.log(`Téléchargement: ${progressObj.percent.toFixed(2)}%`);
});
autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour prête',
    message: `Une nouvelle version de SkyStore (${info.version}) a été téléchargée. L'application va redémarrer pour l'installer.`,
    buttons: ['Redémarrer', 'Plus tard']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// --- Helper local de spooling brut ---
function printRawBuffer(printerName, buffer) {
  const tempBinFile = path.join(app.getPath('temp'), 'skystore_print.bin');
  fs.writeFileSync(tempBinFile, buffer);

  const tempPs1File = path.join(app.getPath('temp'), 'skystore_print.ps1');

  const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
using System.IO;

public class RawPrintHelper {
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;
        di.pDocName = "SKYSTORE Receipt";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    byte[] bytes = File.ReadAllBytes(szFileName);
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    EndPagePrinter(hPrinter);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@
if (-not ([Ref].Assembly.GetType('RawPrintHelper'))) {
    Add-Type -TypeDefinition $code
}
[RawPrintHelper]::SendFileToPrinter('${printerName}', '${tempBinFile.replace(/\\/g, '\\\\')}')
`;

  fs.writeFileSync(tempPs1File, psScript, 'utf8');

  return new Promise((resolve, reject) => {
    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempPs1File}"`, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempPs1File); } catch (e) { }
      try { fs.unlinkSync(tempBinFile); } catch (e) { }

      if (err) {
        reject(err.message);
      } else if (stdout.includes('False')) {
        reject('Failed to print to spooler: ' + printerName);
      } else {
        resolve('Success');
      }
    });
  });
}

// --- Impression Directe Brute ESC/POS avec tracé de Code-barres ---
function imprimerTicketRaw(data, printerName = 'XP-80C') {
  try {
    const bufferChunks = [];

    // 1. Initialisation
    bufferChunks.push(Buffer.from([0x1B, 0x40])); // ESC @

    // 2. Ouverture automatique du tiroir-caisse
    bufferChunks.push(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])); // Pin 2
    bufferChunks.push(Buffer.from([0x1B, 0x70, 0x01, 0x19, 0xFA])); // Pin 5

    // 3. Entête (Nom Boutique)
    const shopNameClean = (data.shopName || 'SKYSTORE').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    bufferChunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrer
    bufferChunks.push(Buffer.from([0x1D, 0x21, 0x11])); // Double hauteur et double largeur
    bufferChunks.push(Buffer.from(shopNameClean + '\n', 'ascii'));
    bufferChunks.push(Buffer.from([0x1D, 0x21, 0x00])); // Retour taille normale

    // Titre du ticket
    const ticketTitle = (data.isZReport ? 'RAPPORT DE CLOTURE Z' : 'TICKET DE CAISSE').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    bufferChunks.push(Buffer.from(ticketTitle + '\n', 'ascii'));
    bufferChunks.push(Buffer.from((data.date || new Date().toLocaleString('fr-FR')) + '\n', 'ascii'));
    bufferChunks.push(Buffer.from([0x1B, 0x61, 0x00])); // Aligner à gauche

    bufferChunks.push(Buffer.from('------------------------------------------------\n', 'ascii'));

    if (data.isZReport) {
      // Rapport Z layout
      const cleanLine = (label, val) => {
        const cleanLabel = (label || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cleanVal = (val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dots = '.'.repeat(Math.max(2, 48 - cleanLabel.length - cleanVal.length));
        return cleanLabel + dots + cleanVal + '\n';
      };
      bufferChunks.push(Buffer.from(cleanLine('Date ouverture', data.dateOuverture || ''), 'ascii'));
      bufferChunks.push(Buffer.from(cleanLine('Date fermeture', data.dateFermeture || ''), 'ascii'));
      bufferChunks.push(Buffer.from(cleanLine('Fond initial', data.fondCaisseInitial || '0'), 'ascii'));
      bufferChunks.push(Buffer.from(cleanLine('Recette attendue', data.recetteAttendue || '0'), 'ascii'));
      bufferChunks.push(Buffer.from(cleanLine('Recette reelle', data.recetteReelle || '0'), 'ascii'));
      bufferChunks.push(Buffer.from(cleanLine('Ecart', data.ecart || '0'), 'ascii'));
      bufferChunks.push(Buffer.from(cleanLine('Recette du jour', data.recetteDuJour || '0'), 'ascii'));
    } else {
      // Facture standard layout
      bufferChunks.push(Buffer.from(`Ticket N: ${data.invoiceId}\n`, 'ascii'));
      bufferChunks.push(Buffer.from(`Caissier: ${data.cashier || 'Admin'}\n`, 'ascii'));
      bufferChunks.push(Buffer.from(`Client:   ${(data.clientName || 'Client En Passant').normalize("NFD").replace(/[\u0300-\u036f]/g, "")}\n`, 'ascii'));
      bufferChunks.push(Buffer.from(`Paiement: ${data.paymentMethod || 'Espèces'}\n`, 'ascii'));
      bufferChunks.push(Buffer.from('------------------------------------------------\n', 'ascii'));

      // Colonnes : Qte (4) Designation (32) Total (12)
      bufferChunks.push(Buffer.from('Qte Designation                      Total\n', 'ascii'));
      bufferChunks.push(Buffer.from('------------------------------------------------\n', 'ascii'));

      const formatProductLine = (qte, nom, total) => {
        let cleanNom = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanNom.length > 32) {
          cleanNom = cleanNom.substring(0, 29) + '...';
        } else {
          cleanNom = cleanNom.padEnd(32, ' ');
        }
        const cleanQte = (qte + 'x').padEnd(4, ' ');
        const cleanTotal = total.padStart(12, ' ');
        return cleanQte + cleanNom + cleanTotal + '\n';
      };

      if (Array.isArray(data.cart)) {
        data.cart.forEach(item => {
          const totalItemVal = item.prix_negocie * item.qte;
          const totalItemStr = Math.round(totalItemVal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
          const line = formatProductLine(item.qte, item.nom, totalItemStr);
          bufferChunks.push(Buffer.from(line, 'ascii'));
        });
      }

      bufferChunks.push(Buffer.from('------------------------------------------------\n', 'ascii'));

      // Total
      const totalVal = typeof data.total === 'number' ? data.total : 0;
      const totalStr = Math.round(totalVal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
      const totalLine = `TOTAL NET: ${totalStr}\n`;
      bufferChunks.push(Buffer.from([0x1B, 0x61, 0x02])); // Alignement droite
      bufferChunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Gras
      bufferChunks.push(Buffer.from(totalLine, 'ascii'));
      bufferChunks.push(Buffer.from([0x1B, 0x45, 0x00])); // Enlever gras

      // Tracé matériel du code-barres (CODE128)
      if (data.invoiceId) {
        bufferChunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrer le code-barres
        bufferChunks.push(Buffer.from('------------------------------------------------\n', 'ascii'));

        // Hauteur (GS h 80) et Position du texte HRI en dessous (GS H 2)
        bufferChunks.push(Buffer.from([
          0x1D, 0x68, 0x50, // GS h 80 (Hauteur du code-barres = 80 dots, ~10mm)
          0x1D, 0x48, 0x02  // GS H 2 (Afficher les caractères textuels sous le code-barres)
        ]));

        // Commande d'impression du code-barres (CODE128)
        const invoiceId = data.invoiceId; // ex: "INV-828519"
        const barcodeData = Buffer.from(invoiceId, 'ascii');
        const barcodeHeader = Buffer.from([
          0x1D, 0x6B, 0x49, // GS k CODE128
          barcodeData.length + 2, // longueur totale (caractères + préfixe subset)
          0x7B, 0x42 // Préfixe Subset B de CODE128 (`{B`)
        ]);
        bufferChunks.push(barcodeHeader);
        bufferChunks.push(barcodeData);
        bufferChunks.push(Buffer.from([0x0A])); // Line Feed
      }
    }

    // Pied de page
    bufferChunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Centrer
    bufferChunks.push(Buffer.from('------------------------------------------------\n', 'ascii'));
    bufferChunks.push(Buffer.from('*** MERCI DE VOTRE VISITE ***\n', 'ascii'));
    
    // 5 sauts de lignes pour dépasser la fente de découpe
    bufferChunks.push(Buffer.from('\n\n\n\n\n', 'ascii'));

    // Commande de coupure automatique ESC/POS : GS V 66 0 (coupe partielle avec avance)
    bufferChunks.push(Buffer.from([0x1D, 0x56, 0x42, 0x00]));

    const finalBuffer = Buffer.concat(bufferChunks);

    // Envoi direct du Buffer à l'imprimante
    return printRawBuffer(printerName, finalBuffer);

  } catch (err) {
    console.error('[Raw Print Error]', err);
    return Promise.reject(err.message);
  }
}

ipcMain.handle('print:ticket-raw', async (event, data, printerName) => {
  return await imprimerTicketRaw(data, printerName);
});