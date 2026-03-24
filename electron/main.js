/**
 * Ruflo Mission Control — Electron Main Process
 * Starts the Express server, opens the dashboard window, adds system tray.
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');   // parent = project root
const SERVER    = path.join(ROOT, 'server.js');
const PORT      = 3847;

let mainWindow, tray, serverProcess;

// ── Start embedded server ─────────────────────────────────
function startServer() {
  serverProcess = fork(SERVER, [], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
  });
  serverProcess.on('exit', code => {
    console.log('Server exited with code', code);
  });
}

// ── Wait until server is ready ────────────────────────────
function waitForServer(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(`http://localhost:${PORT}/health`, res => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      attempts++;
      if (attempts >= maxAttempts) return reject(new Error('Server did not start'));
      setTimeout(check, 500);
    };
    check();
  });
}

// ── Create main window ─────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '🌊 Ruflo Mission Control',
    backgroundColor: '#090e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    // icon will be set below if found
  });

  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) mainWindow.setIcon(iconPath);

  mainWindow.loadURL(`http://localhost:${PORT}/dashboard.html`);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', e => {
    if (tray) { e.preventDefault(); mainWindow.hide(); }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── System tray ────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const img = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('Ruflo Mission Control');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '🌊 Open Dashboard', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: '⟳ Refresh', click: () => mainWindow.webContents.reload() },
    { label: '🔧 Open in Browser', click: () => shell.openExternal(`http://localhost:${PORT}/dashboard.html`) },
    { type: 'separator' },
    { label: '✕ Quit', click: () => { tray = null; app.quit(); } },
  ]));
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── IPC handlers ──────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// ── App lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
  startServer();
  try { await waitForServer(); } catch { /* continue anyway */ }
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows/Linux
  if (process.platform === 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
});

app.on('before-quit', () => {
  tray = null;
  if (serverProcess) serverProcess.kill();
});
