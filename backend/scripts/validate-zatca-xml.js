#!/usr/bin/env node
/**
 * Standalone script to validate a UBL 2.1 invoice XML file using the ZATCA SDK CLI.
 * Usage: node scripts/validate-zatca-xml.js <path-to-invoice.xml>
 *    or: npm run zatca:validate -- storage/xml/INV-xxx.xml
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendRoot = path.resolve(__dirname, '..');
const sdkRoot = process.env.ZATCA_SDK_PATH || path.join(backendRoot, 'zatca-envoice-sdk-203');

const globalPath = path.join(sdkRoot, 'Apps', 'global.json');
let version = '3.0.8';
let certPassword = '123456789';
if (fs.existsSync(globalPath)) {
  try {
    const global = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
    version = global.version || version;
    certPassword = global.certPassword || certPassword;
  } catch (_) {}
}

const jarName = `cli-${version}-jar-with-dependencies.jar`;
const jarPath = path.join(sdkRoot, 'Apps', jarName);

function ensureConfig() {
  const configDir = path.join(sdkRoot, 'Configuration');
  const configPath = path.join(configDir, 'config.json');
  const config = {
    xsdPath: path.join(sdkRoot, 'Data', 'Schemas', 'xsds', 'UBL2.1', 'xsd', 'maindoc', 'UBL-Invoice-2.1.xsd'),
    enSchematron: path.join(sdkRoot, 'Data', 'Rules', 'schematrons', 'CEN-EN16931-UBL.xsl'),
    zatcaSchematron: path.join(sdkRoot, 'Data', 'Rules', 'schematrons', '20210819_ZATCA_E-invoice_Validation_Rules.xsl'),
    certPath: path.join(sdkRoot, 'Data', 'Certificates', 'cert.pem'),
    privateKeyPath: path.join(sdkRoot, 'Data', 'Certificates', 'ec-secp256k1-priv-key.pem'),
    pihPath: path.join(sdkRoot, 'Data', 'PIH', 'pih.txt'),
    certPassword,
    inputPath: path.join(sdkRoot, 'Data', 'Input'),
    usagePathFile: path.join(sdkRoot, 'Configuration', 'usage.txt'),
  };
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

const xmlArg = process.argv[2];
if (!xmlArg) {
  console.error('Usage: node scripts/validate-zatca-xml.js <path-to-invoice.xml>');
  console.error('');
  console.error('Pass the path to a real UBL 2.1 invoice XML file (e.g. one saved when you issue an invoice).');
  const storageXml = path.join(backendRoot, 'storage', 'xml');
  if (fs.existsSync(storageXml)) {
    const files = fs.readdirSync(storageXml).filter((f) => f.endsWith('.xml'));
    if (files.length) {
      console.error('Example — XML files in storage/xml/:');
      files.slice(0, 5).forEach((f) => console.error('  npm run zatca:validate -- storage/xml/' + f));
    }
  }
  process.exit(1);
}

const xmlPath = path.isAbsolute(xmlArg) ? xmlArg : path.resolve(process.cwd(), xmlArg);
if (!fs.existsSync(xmlPath)) {
  console.error('File not found: ' + xmlPath);
  console.error('');
  console.error('Use a path to an actual invoice XML file. After issuing an invoice, XML is saved under storage/xml/.');
  const storageXml = path.join(backendRoot, 'storage', 'xml');
  if (fs.existsSync(storageXml)) {
    const files = fs.readdirSync(storageXml).filter((f) => f.endsWith('.xml'));
    if (files.length) {
      console.error('Available in storage/xml/:');
      files.slice(0, 10).forEach((f) => console.error('  storage/xml/' + f));
      console.error('Example: npm run zatca:validate -- storage/xml/' + files[0]);
    } else {
      console.error('No XML files in storage/xml/ yet. Issue an invoice first (via API or app), then run this script.');
    }
  } else {
    console.error('No storage/xml/ folder yet. Issue an invoice first to generate XML.');
  }
  process.exit(1);
}

if (!fs.existsSync(jarPath)) {
  console.error('ZATCA SDK JAR not found:', jarPath);
  console.error('Place cli-' + version + '-jar-with-dependencies.jar in backend/zatca-envoice-sdk-203/Apps/');
  process.exit(1);
}

const configPath = ensureConfig();
const env = {
  ...process.env,
  SDK_CONFIG: configPath,
  FATOORA_HOME: path.join(sdkRoot, 'Apps'),
};

const result = spawnSync(
  'java',
  [
    '-Djdk.module.illegalAccess=deny',
    '-Dfile.encoding=UTF-8',
    '-jar', jarPath,
    '--globalVersion', version,
    '-certpassword', certPassword,
    '-validate',
    '-invoice', xmlPath,
  ],
  { env, cwd: sdkRoot, encoding: 'utf-8', timeout: 30000 }
);

const out = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
console.log(out || (result.status === 0 ? 'Validation passed.' : 'Validation failed.'));
process.exit(result.status === 0 ? 0 : 1);
