/**
 * Removes dist-electron/ before a fresh pack. Run fails if Setup.exe or the app is still open — close them first.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'dist-electron');

if (fs.existsSync(dir)) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('Removed dist-electron/');
  } catch (e) {
    console.error(
      '\nCould not delete dist-electron/ (file in use). Close:\n' +
        '  • ZATCA E-Invoicing if it is running\n' +
        '  • Any Explorer window inside dist-electron\\\n' +
        '  • Then run npm run electron:pack again.\n',
    );
    throw e;
  }
} else {
  console.log('dist-electron/ already absent, skip clean.');
}
