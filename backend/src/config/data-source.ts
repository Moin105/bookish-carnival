import 'dotenv/config';
import { DataSource } from 'typeorm';

// Minimal DataSource for running TypeORM migrations via CLI.
// IMPORTANT: Keep this file lightweight (no entity imports that may trigger
// optional native modules) so `migration:run` works reliably.

const databaseUrl = process.env.DATABASE_URL;
const sslEnabled =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  !!databaseUrl;

const sslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

export const AppDataSource = new DataSource({
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
  // Migrations only; entities are not required to run migrations.
  entities: [],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
});

