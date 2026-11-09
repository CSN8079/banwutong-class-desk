const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1040,
    minHeight: 720,
    title: '班务通',
    backgroundColor: '#f2f0e9',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

ipcMain.handle('save-file', async (_event, payload) => {
  if (!payload || typeof payload.filename !== 'string' || typeof payload.base64 !== 'string') {
    throw new Error('无效的导出文件参数');
  }
  const extension = path.extname(payload.filename).toLowerCase();
  const filters = extension === '.csv'
    ? [{ name: 'CSV 表格', extensions: ['csv'] }]
    : extension === '.xlsx'
      ? [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    : extension === '.html'
      ? [{ name: 'HTML 报告', extensions: ['html'] }]
      : extension === '.json'
        ? [{ name: 'JSON 备份', extensions: ['json'] }]
        : [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp'] }];

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出文件',
    defaultPath: path.join(app.getPath('documents'), payload.filename),
    filters,
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, Buffer.from(payload.base64, 'base64'));
  return { canceled: false, path: result.filePath };
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.cs8079.banwutong');
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
