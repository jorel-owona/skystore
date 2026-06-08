const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const initDB = require('./database');
const fs = require('fs');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let splashWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    // CORRECTION : Chemin absolu et extension .ico
    icon: path.join(__dirname, '../asset/logoSkyStore.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  splashWindow = new BrowserWindow({
    width: 450,
    height: 450,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    // CORRECTION : Chemin absolu et extension .ico
    icon: path.join(__dirname, '../asset/logoSkyStore.ico'),
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
  const userDataPath = app.getPath('userData');
  db = initDB(path.join(userDataPath, 'skystore.sqlite'));

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

// --- Impression silencieuse (avec imprimante cible facultative) ---
ipcMain.handle('print:silent', async (event, printerName) => {
  const win = mainWindow;
  if (!win) return Promise.reject('Fenêtre principale non trouvée');

  const options = {
    silent: true,
    printBackground: true,
    margins: { marginType: 'none' }
  };

  if (printerName) {
    options.deviceName = printerName;
  }

  return new Promise((resolve, reject) => {
    win.webContents.print(options, (success, failureReason) => {
      if (!success) reject(failureReason);
      else resolve('Impression réussie');
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