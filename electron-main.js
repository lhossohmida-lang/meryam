const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// =============================================================================
//  WALIDA — Electron Main Process
//  Opens the Baraa Kids web app in a native desktop window.
// =============================================================================

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 380,
    minHeight: 680,
    title: 'براءة — Baraa Kids',
    // Use app icon if available
    icon: path.join(__dirname, 'public', 'icons', 'icon-512.png'),
    backgroundColor: '#FFF6F0',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    // Frameless modern look
    frame: true,
    autoHideMenuBar: true,
    titleBarStyle: 'default'
  });

  // Load the Firebase-deployed PWA
  // In production, replace with your real Firebase URL
  const FIREBASE_URL = 'https://mreim-3027a.web.app';
  const LOCAL_BUILD  = path.join(__dirname, 'dist', 'index.html');

  // Try local dist first, fall back to Firebase URL
  const fs = require('fs');
  if (fs.existsSync(LOCAL_BUILD)) {
    mainWindow.loadFile(LOCAL_BUILD);
  } else {
    mainWindow.loadURL(FIREBASE_URL);
  }

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
