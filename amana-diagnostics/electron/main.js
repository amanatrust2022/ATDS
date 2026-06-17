const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const net = require('net');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let nextProcess = null;
let tray = null;
let isQuitting = false;
let serverPort = 3000;

// Helper to find a free port dynamically
function findFreePort(startPort, callback) {
  const server = net.createServer();
  server.listen(startPort, '0.0.0.0', () => {
    server.close(() => {
      callback(startPort);
    });
  });
  server.on('error', () => {
    findFreePort(startPort + 1, callback);
  });
}

// Determine if we are in development mode
const isDev = !app.isPackaged;

// Helper to get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip loopback and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

// 1. Spawning Next.js Server
function startNextServer() {
  const cwd = path.resolve(__dirname, '..');
  
  let nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
  if (process.platform === 'win32') {
    nextBin += '.cmd';
  }

  console.log(`Starting Next.js server on port ${serverPort}...`);
  
  nextProcess = spawn(
    nextBin,
    [isDev ? 'dev' : 'start', '-p', serverPort.toString(), '-H', '0.0.0.0'],
    {
      cwd,
      env: {
        ...process.env,
        IS_LOCAL_HUB: 'true',
        NEXT_PUBLIC_LOCAL_SERVER_MODE: 'true',
        PORT: serverPort.toString()
      }
    }
  );

  nextProcess.stdout.on('data', (data) => {
    console.log(`[Next.js STDOUT]: ${data}`);
  });

  nextProcess.stderr.on('data', (data) => {
    console.error(`[Next.js STDERR]: ${data}`);
  });

  nextProcess.on('close', (code) => {
    console.log(`Next.js process exited with code ${code}`);
  });
}

// 2. Poll Next.js server until it responds
function waitForServer(callback) {
  const req = http.get(`http://localhost:${serverPort}/api/config`, (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => waitForServer(callback), 500);
    }
  });

  req.on('error', () => {
    setTimeout(() => waitForServer(callback), 500);
  });
}

// 3. Register mDNS Bonjour Service
function registerBonjour() {
  try {
    const Bonjour = require('bonjour-service').default;
    const bonjour = new Bonjour();
    
    // Register the clinic hub on the local network
    bonjour.publish({
      name: 'Amana Diagnostics Hub',
      type: 'http',
      port: serverPort,
      txt: { path: '/' }
    });
    console.log('mDNS Bonjour service registered: http://amana-hub.local:' + serverPort);
  } catch (err) {
    console.warn('mDNS Bonjour registration failed (bonjour-service library may not be installed):', err);
  }
}

// 4. Create Main Window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Amana Diagnostics Local Hub',
    icon: path.join(__dirname, '../public/manifest.json'), // Fallback to icon if needed
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the loading splash screen first
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  // Find a free port starting at 3000
  findFreePort(3000, (port) => {
    serverPort = port;
    
    // Start Next.js and wait for it to be ready
    startNextServer();
    
    waitForServer(() => {
      console.log(`Next.js server is ready on port ${serverPort}. Loading app...`);
      mainWindow.loadURL(`http://localhost:${serverPort}`);
      registerBonjour();
      setupAutoUpdater();
    });
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide(); // Minimize to system tray
    }
  });
}

// 5. System Tray Menu Configuration
function createTray() {
  const trayIcon = path.join(__dirname, '../public/uss-pics/N SCAN PELVIC.jpeg'); // Or fallback icon
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Local Hub Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: 'Clinic Connections...',
      click: () => {
        const ips = getLocalIPs();
        let message = `Direct Laptops to connect to the same Wi-Fi router.\n\nOpen a web browser on other laptops and enter:\n`;
        ips.forEach(ip => {
          message += `   --> http://${ip.address}:${serverPort}\n`;
        });
        const { dialog } = require('electron');
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Clinic Connection Info',
          message: message,
          buttons: ['OK']
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Restart Next.js Server',
      click: () => {
        if (nextProcess) {
          nextProcess.kill();
        }
        startNextServer();
      }
    },
    {
      label: 'Quit Diagnostics Hub',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Amana Diagnostics Local Hub');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

// 6. Over-The-Air Update Configuration
function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', 'checking');
  });

  autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', 'available');
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', 'not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('update-status', `downloading:${Math.round(progressObj.percent)}`);
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', 'ready-to-install');
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-status', `error:${err.message}`);
  });

  // Check for updates every 4 hours
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
}

// 7. IPC Messages handlers
ipcMain.handle('get-local-ips', () => {
  return getLocalIPs();
});

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.on('restart-and-install', () => {
  autoUpdater.quitAndInstall();
});

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (nextProcess) {
    nextProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
