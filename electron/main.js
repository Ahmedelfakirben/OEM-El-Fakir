/**
 * electron/main.js
 * Proceso principal de Electron para OEM Driver Auditor.
 * Inicia el backend local de Express y abre la interfaz de escritorio nativa.
 */

'use strict';

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let expressServer = null;
const DEFAULT_PORT = 3000;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

async function startBackend() {
  const isAvailable = await isPortAvailable(DEFAULT_PORT);
  const portToUse = isAvailable ? DEFAULT_PORT : 0;
  process.env.PORT = String(portToUse);

  try {
    const { startServer } = require('../server');
    expressServer = await startServer(portToUse);
    const actualPort = expressServer.address().port;
    process.env.PORT = String(actualPort);
    return actualPort;
  } catch (err) {
    console.error('Error al iniciar el servidor Express interno:', err);
    throw err;
  }
}

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'OEM Driver Explorer — Auditoría de Flota & Windows Update',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#0a0e1a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const appUrl = `http://localhost:${port}`;

  let loaded = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await mainWindow.loadURL(appUrl);
      loaded = true;
      break;
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  if (!loaded) {
    dialog.showErrorBox(
      'Error de inicio',
      'No se pudo conectar con el servidor interno de OEM Driver Auditor.'
    );
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

  app.whenReady().then(async () => {
    try {
      const port = await startBackend();
      await createWindow(port);
    } catch (err) {
      dialog.showErrorBox(
        'Fallo al iniciar aplicación',
        `Ocurrió un error al inicializar el servicio interno:\n${err.message}`
      );
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && expressServer) {
        createWindow(expressServer.address().port);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (expressServer) {
      expressServer.close(() => {
        app.quit();
      });
    } else {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (expressServer) {
      expressServer.close();
    }
  });
}
