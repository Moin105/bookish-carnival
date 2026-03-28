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

function waitForHttp(url, timeoutMs = 180000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let done = false;
    const tryOnce = () => {
      if (done) return;
      const req = http.get(url, (res) => {
        res.resume();
        if (!done) {
          done = true;
          resolve();
        }
      });
      req.on('error', () => {
        if (done) return;
        if (Date.now() - started > timeoutMs) {
          done = true;
          try {
            req.destroy();
          } catch {
            /* ignore */
          }
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(tryOnce, 400);
        }
      });
    };
    tryOnce();
  });
}

/** If child exits before health responds, fail immediately (log path for support). */
function rejectIfProcessExits(proc, logLabel, logPath) {
  return new Promise((_, reject) => {
    proc.once('exit', (code, signal) => {
      if (code === 0 || code === null) return;
      const hint = logPath
        ? `See log: ${logPath}`
        : '';
      reject(
        new Error(
          `${logLabel} exited (code ${code}${signal ? `, signal ${signal}` : ''}). ${hint}`.trim(),
        ),
      );
    });
  });
}

function spawnBackend(nodeBin, backendDir, extraEnv) {
  const puppeteerCache = path.join(app.getPath('userData'), 'puppeteer-cache');
  const sqlitePath = path.join(app.getPath('userData'), 'zatca.db');

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: BACKEND_PORT,
    FRONTEND_URLS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}`,
    PUPPETEER_CACHE_DIR: puppeteerCache,
  };

  // User %APPDATA%\zatca-einvoicing\.env merged here — can override PORT / DB_* from dev machine.
  Object.assign(env, extraEnv);

  if (app.isPackaged) {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    // Force desktop SQLite + correct port (must win over any .env left from Postgres dev).
    env.PORT = String(BACKEND_PORT);
    env.DB_TYPE = 'sqlite';
    env.SQLITE_PATH = sqlitePath;
    env.PDF_PUPPETEER_LAUNCH_ON_BOOT = 'false';
    for (const k of [
      'DATABASE_URL',
      'DB_HOST',
      'DB_PORT',
      'DB_USERNAME',
      'DB_PASSWORD',
      'DB_DATABASE',
      'DB_SSL',
    ]) {
      delete env[k];
    }
  }

  const mainJs = path.join(backendDir, 'dist', 'main.js');
  if (!fs.existsSync(mainJs)) {
    throw new Error(`Backend not found at ${mainJs}. Run the full Electron build.`);
  }

  const logDir = app.getPath('userData');
  fs.mkdirSync(logDir, { recursive: true });
  const useLogs = app.isPackaged;

  const child = spawn(nodeBin, [mainJs], {
    cwd: backendDir,
    env,
    // Windows: must use 'pipe' then stream to file — WriteStream is not valid for stdio here.
    stdio: useLogs ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (useLogs) {
    const logPath = path.join(logDir, 'backend.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(
      `\n--- ${new Date().toISOString()} spawn backend cwd=${backendDir} PORT=${env.PORT} DB_TYPE=${env.DB_TYPE} ---\n`,
    );
    child.stdout.pipe(logStream, { end: false });
    child.stderr.pipe(logStream, { end: false });
  }

  return child;
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
  if (app.isPackaged) {
    env.PORT = String(FRONTEND_PORT);
  }

  const logDir = app.getPath('userData');
  fs.mkdirSync(logDir, { recursive: true });
  const useLogs = app.isPackaged;

  const child = spawn(nodeBin, [serverJs], {
    cwd: frontendDir,
    env,
    stdio: useLogs ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (useLogs) {
    const logPath = path.join(logDir, 'frontend.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n--- ${new Date().toISOString()} spawn frontend cwd=${frontendDir} ---\n`);
    child.stdout.pipe(logStream, { end: false });
    child.stderr.pipe(logStream, { end: false });
  }

  return child;
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

    const userData = app.getPath('userData');
    const backendLogPath = path.join(userData, 'backend.log');

    backendProcess = spawnBackend(nodeBin, backendDir, extraEnv);
    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend exited with code ${code}`);
      }
    });

    await Promise.race([
      waitForHttp(`http://127.0.0.1:${BACKEND_PORT}/health`, 180000),
      rejectIfProcessExits(backendProcess, 'Backend API', backendLogPath),
    ]);

    frontendProcess = spawnFrontend(nodeBin, frontendDir);
    frontendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Frontend server exited with code ${code}`);
      }
    });

    await Promise.race([
      waitForHttp(FRONTEND_URL, 180000),
      rejectIfProcessExits(
        frontendProcess,
        'Next.js server',
        path.join(userData, 'frontend.log'),
      ),
    ]);
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
