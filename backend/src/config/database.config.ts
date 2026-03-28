import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoiceSequence } from '../entities/invoice-sequence.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { CreditNoteItem } from '../entities/credit-note-item.entity';
import { DebitNote } from '../entities/debit-note.entity';
import { DebitNoteItem } from '../entities/debit-note-item.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

const entities = [
  Company,
  Customer,
  Invoice,
  InvoiceItem,
  InvoiceSequence,
  CreditNote,
  CreditNoteItem,
  DebitNote,
  DebitNoteItem,
  AuditLog,
  User,
];

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  private usePostgres(): boolean {
    const t = this.configService.get<string>('DB_TYPE')?.toLowerCase();
    if (t === 'postgres') return true;
    if (t === 'sqlite') return false;
    const url = this.configService.get<string>('DATABASE_URL');
    if (url && /^postgres/i.test(url.trim())) return true;
    const host = this.configService.get<string>('DB_HOST');
    return !!host && host.trim().length > 0;
  }

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isDev = this.configService.get<string>('NODE_ENV') === 'development';

    if (this.usePostgres()) {
      const databaseUrl = this.configService.get<string>('DATABASE_URL');
      const sslEnabled =
        this.configService.get<string>('DB_SSL') === 'true' ||
        this.configService.get<string>('DB_SSL') === '1' ||
        !!databaseUrl;
      const sslRejectUnauthorized =
        this.configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED', 'false') === 'true';

      return {
        type: 'postgres',
        ...(databaseUrl
          ? {
              url: databaseUrl,
              ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
            }
          : {
              host: this.configService.get<string>('DB_HOST', 'localhost'),
              port: this.configService.get<number>('DB_PORT', 5432),
              username: this.configService.get<string>('DB_USERNAME', 'postgres'),
              password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
              database: this.configService.get<string>('DB_DATABASE', 'zatca_einvoicing'),
              ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
            }),
        entities,
        synchronize: isDev,
        logging: isDev,
        migrations: ['dist/migrations/*.js'],
        migrationsRun: !isDev,
        migrationsTableName: 'migrations',
      };
    }

    const sqlitePath =
      this.configService.get<string>('SQLITE_PATH') ||
      path.join(process.cwd(), 'data', 'zatca.db');

    const dir = path.dirname(sqlitePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // sql.js = WASM SQLite (no native compile); good for desktop / Electron packaging.
    return {
      type: 'sqljs',
      location: sqlitePath,
      autoSave: true,
      entities,
      synchronize: true,
      logging: isDev,
    };
  }
}
