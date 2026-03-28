/**
 * Builds backend + Next standalone and stages everything under dist-pack/
 * for electron-builder extraResources.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distPack = path.join(root, 'dist-pack');

const API_URL = 'http://127.0.0.1:3001';

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function cp(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

rm(distPack);
fs.mkdirSync(distPack, { recursive: true });

const backendRoot = path.join(root, 'backend');
const frontendRoot = path.join(root, 'frontend');

console.log('Building NestJS backend...');
execSync('npm run build', { cwd: backendRoot, stdio: 'inherit' });

console.log('Building Next.js (standalone)...');
execSync('npm run build', {
  cwd: frontendRoot,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_API_URL: API_URL },
});

const backendOut = path.join(distPack, 'backend');
fs.mkdirSync(backendOut, { recursive: true });

cp(path.join(backendRoot, 'dist'), path.join(backendOut, 'dist'));
fs.copyFileSync(path.join(backendRoot, 'package.json'), path.join(backendOut, 'package.json'));
const backendLock = path.join(backendRoot, 'package-lock.json');
if (fs.existsSync(backendLock)) {
  fs.copyFileSync(backendLock, path.join(backendOut, 'package-lock.json'));
}

for (const extra of ['fonts', 'images']) {
  const p = path.join(backendRoot, extra);
  if (fs.existsSync(p)) {
    cp(p, path.join(backendOut, extra));
  }
}

console.log('Installing backend production dependencies in dist-pack...');
execSync('npm install --omit=dev', { cwd: backendOut, stdio: 'inherit' });

const standalone = path.join(frontendRoot, '.next', 'standalone');
if (!fs.existsSync(standalone)) {
  throw new Error('Missing .next/standalone — ensure frontend/next.config.js has output: "standalone".');
}

const frontendOut = path.join(distPack, 'frontend');
fs.mkdirSync(frontendOut, { recursive: true });

// Monorepo / workspace builds nest the app under standalone/<packageName>/ (e.g. standalone/frontend/).
const nestedApp = path.join(standalone, 'frontend');
const appRoot = fs.existsSync(path.join(nestedApp, 'server.js')) ? nestedApp : standalone;

cp(appRoot, frontendOut);

const nodeModulesSrc = path.join(standalone, 'node_modules');
if (fs.existsSync(nodeModulesSrc)) {
  cp(nodeModulesSrc, path.join(frontendOut, 'node_modules'));
}

const staticSrc = path.join(frontendRoot, '.next', 'static');
const staticDest = path.join(frontendOut, '.next', 'static');
fs.mkdirSync(path.dirname(staticDest), { recursive: true });
cp(staticSrc, staticDest);

const publicSrc = path.join(frontendRoot, 'public');
if (fs.existsSync(publicSrc)) {
  cp(publicSrc, path.join(frontendOut, 'public'));
}

console.log('Done. Staged app is in dist-pack/');
