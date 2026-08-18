/**
 * Windows desktop shell for C.R.S Power Solution.
 *
 * The app runs fully offline: the React bundle is loaded from disk and the
 * business core executes inside the renderer against local storage. There is
 * no server and no network dependency.
 *
 * Security posture (this handles the shop's financial data):
 *   - contextIsolation on, nodeIntegration off — renderer cannot touch Node
 *   - a tiny, explicitly enumerated preload bridge instead of remote access
 *   - navigation to external origins is blocked; new windows open in the
 *     user's real browser rather than an unrestricted Electron window
 */

const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const isDev = !app.isPackaged;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f1f5f9',
    title: 'C.R.S Power Solution — Billing & Inventory',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show only once painted, to avoid a white flash on slower machines.
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Keep the app locked to its own content.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? (process.env.ELECTRON_START_URL || 'http://localhost:5173') : null;
    if (allowed && url.startsWith(allowed)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ------------------------------------------------------------ menu bar -- */

function buildMenu() {
  const template = [
    {
      label: '&File',
      submenu: [
        {
          label: 'New Invoice',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('navigate', '/invoices/new'),
        },
        { type: 'separator' },
        {
          label: 'Backup data to file…',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('request-backup'),
        },
        {
          label: 'Restore from backup…',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Restore C.R.S Power Solution backup',
              filters: [{ name: 'Backup', extensions: ['json'] }],
              properties: ['openFile'],
            });
            if (canceled || !filePaths[0]) return;
            try {
              const contents = fs.readFileSync(filePaths[0], 'utf8');
              mainWindow?.webContents.send('restore-backup', contents);
            } catch (err) {
              dialog.showErrorBox('Restore failed', err.message);
            }
          },
        },
        { type: 'separator' },
        { label: 'Print invoice', accelerator: 'CmdOrCtrl+P', role: 'print' },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&Go',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => go('/') },
        { label: 'Invoices', accelerator: 'CmdOrCtrl+2', click: () => go('/invoices') },
        { label: 'Customers', accelerator: 'CmdOrCtrl+3', click: () => go('/customers') },
        { label: 'Inventory', accelerator: 'CmdOrCtrl+4', click: () => go('/inventory') },
        { label: 'GST Reports', accelerator: 'CmdOrCtrl+5', click: () => go('/reports') },
      ],
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'C.R.S Power Solution — Billing & Inventory',
              detail:
                'Version ' + app.getVersion() + '\n\n'
                + 'No.16, ECR Main Road, Pillaichavady,\nPondicherry - 605014\n\n'
                + 'Runs fully offline. Your data is stored on this computer only.\n'
                + 'Use File ▸ Backup regularly.',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  function go(route) {
    mainWindow?.webContents.send('navigate', route);
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ ipc -- */

/** Renderer asks the main process to write a backup wherever the user chooses. */
ipcMain.handle('save-backup', async (_event, json) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save backup',
    defaultPath: `CRS-Power-backup-${stamp}.json`,
    filters: [{ name: 'Backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, json, 'utf8');
  return { saved: true, filePath };
});

ipcMain.handle('app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataPath: app.getPath('userData'),
}));

/* --------------------------------------------------------- app lifecycle -- */

// Single instance: a second launch focuses the existing window instead of
// opening a rival copy that would fight over the same data.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    buildMenu();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
