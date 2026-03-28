import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

/** CLI migrations — Postgres when DB_HOST / postgres DATABASE_URL is set; otherwise SQLite. */

function usePostgres(): boolean {
  const t = process.env.DB_TYPE?.toLowerCase();
  if (t === 'postgres') return true;
  if (t === 'sqlite') return false;
  const url = process.env.DATABASE_URL?.trim();
  if (url && /^postgres/i.test(url)) return true;
  return !!process.env.DB_HOST && process.env.DB_HOST.trim().length > 0;
}

const databaseUrl = process.env.DATABASE_URL;
const sslEnabled =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  !!databaseUrl;
const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

function buildOptions(): DataSourceOptions {
  if (usePostgres()) {
    return {
      type: 'postgres',
      ...(databaseUrl
        ? {
            url: databaseUrl,
            ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
          }
        : {
            host: process.env.DB_HOST ?? 'localhost',
            port: Number(process.env.DB_PORT ?? 5432),
            username: process.env.DB_USERNAME ?? 'postgres',
            password: process.env.DB_PASSWORD ?? 'postgres',
            database: process.env.DB_DATABASE ?? 'zatca_einvoicing',
            ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
          }),
      entities: [],
      migrations: ['src/migrations/*.ts'],
      migrationsTableName: 'migrations',
    };
  }

  const sqlitePath =
    process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'zatca.db');
  const dir = path.dirname(sqlitePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    type: 'sqljs',
    location: sqlitePath,
    autoSave: true,
    entities: [],
    migrations: ['src/migrations/*.ts'],
    migrationsTableName: 'migrations',
  };
}

export const AppDataSource = new DataSource(buildOptions());
