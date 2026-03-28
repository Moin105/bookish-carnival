import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderNumberToInvoices1770000000002 implements MigrationInterface {
  name = 'AddOrderNumberToInvoices1770000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS "orderNumber" varchar(100);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_orderNumber"
      ON invoices ("orderNumber");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_invoices_orderNumber";
    `);
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP COLUMN IF EXISTS "orderNumber";
    `);
  }
}

