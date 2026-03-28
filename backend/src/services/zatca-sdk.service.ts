import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface ZatcaValidationResult {
  valid: boolean;
  output: string;
  errors?: string[];
  sdkAvailable: boolean;
}

/**
 * Service to run ZATCA E-Invoice SDK CLI for offline validation of UBL 2.1 XML
 * against ZATCA business rules. Requires Java 21 or 22 and the SDK JAR in the SDK folder.
 */
@Injectable()
export class ZatcaSdkService {
  private readonly sdkRoot: string;
  private readonly jarPath: string | null;
  private readonly version: string;
  private readonly certPassword: string;

  constructor(private configService: ConfigService) {
    const backendRoot = path.resolve(__dirname, '../..');
    this.sdkRoot =
      this.configService.get<string>('ZATCA_SDK_PATH') ||
      path.join(backendRoot, 'zatca-envoice-sdk-203');

    const globalPath = path.join(this.sdkRoot, 'Apps', 'global.json');
    if (fs.existsSync(globalPath)) {
      try {
        const global = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
        this.version = global.version || '3.0.8';
        this.certPassword = global.certPassword || '123456789';
      } catch {
        this.version = '3.0.8';
        this.certPassword = '123456789';
      }
    } else {
      this.version = '3.0.8';
      this.certPassword = '123456789';
    }
    this.jarPath = this.resolveJarPath();
  }

  private resolveJarPath(): string | null {
    const jarName = `cli-${this.version}-jar-with-dependencies.jar`;
    const appsPath = path.join(this.sdkRoot, 'Apps');
    const jarPath = path.join(appsPath, jarName);
    if (fs.existsSync(jarPath)) {
      return jarPath;
    }
    return null;
  }

  /**
   * Whether the SDK CLI is available (JAR and Java present).
   */
  isAvailable(): boolean {
    if (!this.jarPath) return false;
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync('java', ['-version'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      return result.status === 0 || (result.stderr && result.stderr.includes('version'));
    } catch {
      return false;
    }
  }

  /**
   * Ensure config.json exists with absolute paths for the current SDK location.
   */
  private ensureConfig(): string {
    const configDir = path.join(this.sdkRoot, 'Configuration');
    const configPath = path.join(configDir, 'config.json');
    const p2Dir = this.sdkRoot.replace(/\\/g, '\\\\');

    const config = {
      xsdPath: path.join(this.sdkRoot, 'Data', 'Schemas', 'xsds', 'UBL2.1', 'xsd', 'maindoc', 'UBL-Invoice-2.1.xsd'),
      enSchematron: path.join(this.sdkRoot, 'Data', 'Rules', 'schematrons', 'CEN-EN16931-UBL.xsl'),
      zatcaSchematron: path.join(this.sdkRoot, 'Data', 'Rules', 'schematrons', '20210819_ZATCA_E-invoice_Validation_Rules.xsl'),
      certPath: path.join(this.sdkRoot, 'Data', 'Certificates', 'cert.pem'),
      privateKeyPath: path.join(this.sdkRoot, 'Data', 'Certificates', 'ec-secp256k1-priv-key.pem'),
      pihPath: path.join(this.sdkRoot, 'Data', 'PIH', 'pih.txt'),
      certPassword: this.certPassword,
      inputPath: path.join(this.sdkRoot, 'Data', 'Input'),
      usagePathFile: path.join(this.sdkRoot, 'Configuration', 'usage.txt'),
    };

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  /**
   * Validate an invoice XML file using the ZATCA SDK CLI.
   * @param xmlFilePath Absolute path to the UBL 2.1 XML file
   */
  async validateInvoiceXml(xmlFilePath: string): Promise<ZatcaValidationResult> {
    if (!this.jarPath) {
      return {
        valid: false,
        output: '',
        errors: ['ZATCA SDK JAR not found. Place cli-3.0.8-jar-with-dependencies.jar in backend/zatca-envoice-sdk-203/Apps/'],
        sdkAvailable: false,
      };
    }

    const normalizedPath = path.isAbsolute(xmlFilePath)
      ? xmlFilePath
      : path.resolve(xmlFilePath);
    if (!fs.existsSync(normalizedPath)) {
      return {
        valid: false,
        output: `File not found: ${normalizedPath}`,
        errors: ['Invoice XML file not found'],
        sdkAvailable: true,
      };
    }

    const configPath = this.ensureConfig();
    const env = {
      ...process.env,
      SDK_CONFIG: configPath,
      FATOORA_HOME: path.join(this.sdkRoot, 'Apps'),
    };

    return new Promise((resolve) => {
      const args = [
        '-Djdk.module.illegalAccess=deny',
        '-Dfile.encoding=UTF-8',
        '-jar',
        this.jarPath,
        '--globalVersion',
        this.version,
        '-certpassword',
        this.certPassword,
        '-validate',
        '-invoice',
        normalizedPath,
      ];

      const proc = spawn('java', args, {
        env,
        cwd: this.sdkRoot,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
      proc.stderr?.on('data', (chunk) => (stderr += chunk.toString()));

      proc.on('close', (code) => {
        const output = [stdout, stderr].filter(Boolean).join('\n').trim();
        const valid = code === 0;
        const errors = valid ? undefined : (output || 'Validation failed').split('\n').filter(Boolean);
        resolve({
          valid,
          output,
          errors,
          sdkAvailable: true,
        });
      });

      proc.on('error', (err) => {
        resolve({
          valid: false,
          output: err.message,
          errors: [`Java execution failed: ${err.message}. Ensure Java 21 or 22 is installed and on PATH.`],
          sdkAvailable: true,
        });
      });

      setTimeout(() => {
        if (proc.kill) proc.kill('SIGTERM');
        if (!proc.killed) {
          resolve({
            valid: false,
            output: 'Validation timed out',
            errors: ['ZATCA SDK validation timed out (30s)'],
            sdkAvailable: true,
          });
        }
      }, 30000);
    });
  }

  /**
   * Sign an invoice XML file using the ZATCA SDK. Writes signed output to signedPath (or overwrites if same).
   * Requires SDK JAR and configured cert/private key in config.
   */
  async signInvoiceXml(
    xmlFilePath: string,
    signedOutputPath?: string,
  ): Promise<{ success: boolean; signedPath?: string; output: string; error?: string }> {
    if (!this.jarPath) {
      return {
        success: false,
        output: '',
        error: 'ZATCA SDK JAR not found',
      };
    }

    const normalizedPath = path.isAbsolute(xmlFilePath) ? xmlFilePath : path.resolve(xmlFilePath);
    if (!fs.existsSync(normalizedPath)) {
      return { success: false, output: '', error: `File not found: ${normalizedPath}` };
    }

    const outPath = signedOutputPath
      ? (path.isAbsolute(signedOutputPath) ? signedOutputPath : path.resolve(signedOutputPath))
      : normalizedPath;

    const configPath = this.ensureConfig();
    const env = {
      ...process.env,
      SDK_CONFIG: configPath,
      FATOORA_HOME: path.join(this.sdkRoot, 'Apps'),
    };

    return new Promise((resolve) => {
      const args = [
        '-Djdk.module.illegalAccess=deny',
        '-Dfile.encoding=UTF-8',
        '-jar',
        this.jarPath,
        '--globalVersion',
        this.version,
        '-certpassword',
        this.certPassword,
        '-sign',
        '-invoice',
        normalizedPath,
        '-signedInvoice',
        outPath,
      ];

      const proc = spawn('java', args, { env, cwd: this.sdkRoot, windowsHide: true });

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
      proc.stderr?.on('data', (chunk) => (stderr += chunk.toString()));

      proc.on('close', (code) => {
        const output = [stdout, stderr].filter(Boolean).join('\n').trim();
        if (code === 0 && fs.existsSync(outPath)) {
          resolve({ success: true, signedPath: outPath, output });
        } else {
          resolve({
            success: false,
            output,
            error: output || 'Signing failed',
            signedPath: fs.existsSync(outPath) ? outPath : undefined,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          output: err.message,
          error: err.message,
        });
      });

      setTimeout(() => {
        if (proc.kill) proc.kill('SIGTERM');
        if (!proc.killed) {
          resolve({
            success: false,
            output: 'Signing timed out',
            error: 'ZATCA SDK signing timed out (60s)',
          });
        }
      }, 60000);
    });
  }
}
