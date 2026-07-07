const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

let mainWindow;

// ── Error Logging & Compatibility ─────────────────────────────

// GPU-safe flags (do NOT call disableHardwareAcceleration — causes lag)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-smooth-scrolling');

// Логируем все фатальные ошибки в файл
const logPath = path.join(app.getPath('userData'), 'error.log');
process.on('uncaughtException', (err) => {
  fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UNCAUGHT: ${err.stack || err}\n`);
});
process.on('unhandledRejection', (reason) => {
  fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
});

// ── Auto-updater config ───────────────────────────────────────

autoUpdater.autoDownload = true;       // скачивает автоматически в фоне
autoUpdater.autoInstallOnAppQuit = true; // устанавливает при следующем закрытии

autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) mainWindow.webContents.send('update-progress', Math.floor(progress.percent));
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('update-not-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err);
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => {
      fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UPDATER ERROR: ${err.stack || err}\n`);
    });
  }
});

// ── Data Directory ────────────────────────────────────────────

function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Window ────────────────────────────────────────────────────

const winStatePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWinState() {
  try {
    if (fs.existsSync(winStatePath)) {
      const s = JSON.parse(fs.readFileSync(winStatePath, 'utf-8'));
      if (!s.width || !s.height) return null;
      // Relaxed check: just make sure top-left corner is roughly on screen
      const { screen } = require('electron');
      const display = screen.getDisplayNearestPoint({ x: s.x || 0, y: s.y || 0 });
      const b = display.workArea;
      // Allow window to be mostly visible (at least 200px of width/height on screen)
      const visibleX = s.x < b.x + b.width - 200;
      const visibleY = s.y < b.y + b.height - 100;
      if (visibleX && visibleY) return s;
    }
  } catch (_) {}
  return null;
}

function saveWinState() {
  try {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    const b = mainWindow.getBounds();
    b.maximized = mainWindow.isMaximized();
    fs.writeFileSync(winStatePath, JSON.stringify(b), 'utf-8');
  } catch (_) {}
}

function createWindow() {
  const saved = loadWinState();

  mainWindow = new BrowserWindow({
    width:     saved?.width  || 1100,
    height:    saved?.height || 920,
    x:         saved?.x,
    y:         saved?.y,
    minWidth:  320,
    minHeight: 500,
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  // Save position/size on every change
  ['move', 'resize'].forEach(ev => mainWindow.on(ev, saveWinState));

  // Restore maximized state
  if (saved?.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Проверяем обновления через 30 секунд после запуска (даём время CDN GitHub распространить файлы)
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => {
          fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UPDATER ERROR: ${err.stack || err}\n`);
        });
      }, 30000);
    }
  });

  mainWindow.on('close', saveWinState);
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('read-data', async (_event, filename) => {
  const dir = getDataDir();
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;
  
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    fs.appendFileSync(path.join(app.getPath('userData'), 'error.log'), `\n[${new Date().toISOString()}] JSON Parse Error for ${filename}: ${err.message}\n`);
    // Rename corrupted file so it doesn't block future starts
    fs.renameSync(filePath, filePath + '.corrupted.' + Date.now());
    return null; // Return null so app initializes fresh
  }
});

ipcMain.handle('write-data', async (_event, filename, data) => {
  const filePath = path.join(getDataDir(), filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
});

ipcMain.handle('get-data-path', () => getDataDir());

ipcMain.handle('get-app-version', () => app.getVersion());

// ── App Lifecycle & Single Instance Lock ────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('before-quit', saveWinState);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
