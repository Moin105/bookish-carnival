/**
 * Downloads the official Node.js Windows x64 zip into electron/node-runtime/
 * so the packaged app can run the backend and Next without a system Node install.
 *
 * Run: node scripts/download-node-runtime.mjs
 */
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const NODE_VERSION = process.env.NODE_RUNTIME_VERSION || '20.18.1';
const zipName = `node-v${NODE_VERSION}-win-x64.zip`;
const url = `https://nodejs.org/dist/v${NODE_VERSION}/${zipName}`;
const outDir = path.join(root, 'electron', 'node-runtime');
const zipPath = path.join(outDir, zipName);

fs.mkdirSync(outDir, { recursive: true });

if (fs.existsSync(path.join(outDir, 'node.exe'))) {
  console.log('electron/node-runtime/node.exe already exists; skip download.');
  process.exit(0);
}

console.log(`Downloading ${url} ...`);

function download() {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error('Redirect without location'));
            return;
          }
          https.get(loc, (res2) => {
            res2.pipe(file);
            file.on('finish', () => file.close(resolve));
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

await download();

console.log('Extracting zip...');
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force"`,
  { stdio: 'inherit' },
);

const nested = path.join(outDir, `node-v${NODE_VERSION}-win-x64`);
if (fs.existsSync(nested)) {
  for (const name of fs.readdirSync(nested)) {
    fs.renameSync(path.join(nested, name), path.join(outDir, name));
  }
  fs.rmSync(nested, { recursive: true });
}

fs.rmSync(zipPath, { force: true });

if (!fs.existsSync(path.join(outDir, 'node.exe'))) {
  throw new Error('node.exe not found after extract — check NODE_RUNTIME_VERSION.');
}

console.log('OK: electron/node-runtime/node.exe is ready.');
