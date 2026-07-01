const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

let mainWindow;

// ── Error Logging & Compatibility ─────────────────────────────

// Отключаем аппаратное ускорение графики (частая причина тихого падения на других ПК)
app.disableHardwareAcceleration();

// Логируем все фатальные ошибки в файл
const logPath = path.join(app.getPath('userData'), 'error.log');
process.on('uncaughtException', (err) => {
  fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UNCAUGHT: ${err.stack || err}\n`);
});
process.on('unhandledRejection', (reason) => {
  fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
});

// ── Auto-updater config ───────────────────────────────────────

// Токен нужен, так как репозиторий на GitHub приватный
autoUpdater.addAuthHeader("token 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");
autoUpdater.autoDownload = true;       // скачивает автоматически в фоне
autoUpdater.autoInstallOnAppQuit = true; // устанавливает при следующем закрытии

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '🔄 Доступно обновление',
    message: `Найдена новая версия ${info.version}`,
    detail: 'Скачивается в фоне. Установится автоматически при следующем закрытии приложения.',
    buttons: ['OK'],
    noLink: true
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '✅ Обновление загружено',
    message: 'Обновление загружено и готово к установке',
    detail: 'Нажми «Установить сейчас» чтобы перезапустить приложение, или «Позже» — установится при следующем закрытии.',
    buttons: ['Установить сейчас', 'Позже'],
    defaultId: 0,
    noLink: true
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err);
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Проверяем обновления через 3 секунды после запуска
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => {
          fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] UPDATER ERROR: ${err.stack || err}\n`);
        });
      }, 3000);
    }
  });
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('read-data', async (_event, filename) => {
  const filePath = path.join(getDataDir(), filename);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return null;
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

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
