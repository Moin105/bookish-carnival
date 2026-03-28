const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let backendProcess = null;
/** @type {import('child_process').ChildProcess | null} */
let frontendProcess = null;

const FRONTEND_PORT = process.env.ELECTRON_FRONTEND_PORT || '3000';
const BACKEND_PORT = process.env.ELECTRON_BACKEND_PORT || '3001';
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

/** Dev: run `npm run dev:backend` + `npm run dev:frontend`, then `npm run electron:dev`. */
function isDevShell() {
  return !app.isPackaged && process.env.ELECTRON_DEV === '1';
}

function resolveNodeExecutable() {
  if (!app.isPackaged) {
    return 'node';
  }
  const win = process.platform === 'win32';
  const bundled = path.join(process.resourcesPath, 'node', win ? 'node.exe' : 'node');
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  return 'node';
}

function getBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.join(__dirname, '..', 'backend');
}

function getFrontendStandaloneDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend');
  }
  const nested = path.join(__dirname, '..', 'frontend', '.next', 'standalone', 'frontend');
  if (fs.existsSync(path.join(nested, 'server.js'))) {
    return nested;
  }
  return path.join(__dirname, '..', 'frontend', '.next', 'standalone');
}

function getUserEnvPath() {
  return path.join(app.getPath('userData'), '.env');
}

function loadExtraEnv() {
  const userEnv = getUserEnvPath();
  if (!fs.existsSync(userEnv)) {
    return {};
  }
  const out = {};
  const text = fs.readFileSync(userEnv, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(tryOnce, 400);
        }
      });
    };
    tryOnce();
  });
}

function spawnBackend(nodeBin, backendDir, extraEnv) {
  const puppeteerCache = path.join(app.getPath('userData'), 'puppeteer-cache');
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: BACKEND_PORT,
    FRONTEND_URLS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}`,
    PUPPETEER_CACHE_DIR: puppeteerCache,
  };

  if (app.isPackaged) {
    const sqlitePath = path.join(app.getPath('userData'), 'zatca.db');
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    env.DB_TYPE = 'sqlite';
    env.SQLITE_PATH = sqlitePath;
  }

  Object.assign(env, extraEnv);

  const mainJs = path.join(backendDir, 'dist', 'main.js');
  if (!fs.existsSync(mainJs)) {
    throw new Error(`Backend not found at ${mainJs}. Run the full Electron build.`);
  }

  return spawn(nodeBin, [mainJs], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
    shell: false,
  });
}

function spawnFrontend(nodeBin, frontendDir) {
  const serverJs = path.join(frontendDir, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Next standalone server not found at ${serverJs}. Build the frontend with output: 'standalone'.`,
    );
  }
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: FRONTEND_PORT,
    HOSTNAME: '127.0.0.1',
  };
  return spawn(nodeBin, [serverJs], {
    cwd: frontendDir,
    env,
    stdio: 'inherit',
    shell: false,
  });
}

function killChild(proc, label) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
        windowsHide: true,
      });
    } else {
      proc.kill('SIGTERM');
    }
  } catch (e) {
    console.error(`Failed to stop ${label}:`, e);
  }
}

async function createWindow() {
  if (isDevShell()) {
    await waitForHttp(FRONTEND_URL, 180000);
  } else {
    const extraEnv = loadExtraEnv();
    const nodeBin = resolveNodeExecutable();
    const backendDir = getBackendDir();
    const frontendDir = getFrontendStandaloneDir();

    backendProcess = spawnBackend(nodeBin, backendDir, extraEnv);
    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend exited with code ${code}`);
      }
    });

    await waitForHttp(`http://127.0.0.1:${BACKEND_PORT}/health`, 120000);

    frontendProcess = spawnFrontend(nodeBin, frontendDir);
    frontendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Frontend server exited with code ${code}`);
      }
    });

    await waitForHttp(FRONTEND_URL, 120000);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(FRONTEND_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error(err);
    dialog.showErrorBox('Startup failed', String(err.message || err));
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killChild(frontendProcess, 'frontend');
  killChild(backendProcess, 'backend');
});
