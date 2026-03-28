import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowCompanyDeleteKeepDocuments1770000000003 implements MigrationInterface {
  name = 'AllowCompanyDeleteKeepDocuments1770000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allow preserving invoices/notes when company is deleted.
    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "companyId" DROP NOT NULL;
      ALTER TABLE "credit_notes" ALTER COLUMN "companyId" DROP NOT NULL;
      ALTER TABLE "debit_notes" ALTER COLUMN "companyId" DROP NOT NULL;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = current_schema()
            AND tc.table_name = 'invoices'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'companyId'
        LOOP
          EXECUTE format('ALTER TABLE "invoices" DROP CONSTRAINT %I', r.constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = current_schema()
            AND tc.table_name = 'credit_notes'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'companyId'
        LOOP
          EXECUTE format('ALTER TABLE "credit_notes" DROP CONSTRAINT %I', r.constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = current_schema()
            AND tc.table_name = 'debit_notes'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'companyId'
        LOOP
          EXECUTE format('ALTER TABLE "debit_notes" DROP CONSTRAINT %I', r.constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = current_schema()
            AND tc.table_name = 'invoice_sequences'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'companyId'
        LOOP
          EXECUTE format('ALTER TABLE "invoice_sequences" DROP CONSTRAINT %I', r.constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_companyId_companies_setnull"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_notes"
      ADD CONSTRAINT "FK_credit_notes_companyId_companies_setnull"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "debit_notes"
      ADD CONSTRAINT "FK_debit_notes_companyId_companies_setnull"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences"
      ADD CONSTRAINT "FK_invoice_sequences_companyId_companies_cascade"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" DROP CONSTRAINT IF EXISTS "FK_invoice_sequences_companyId_companies_cascade";
      ALTER TABLE "debit_notes" DROP CONSTRAINT IF EXISTS "FK_debit_notes_companyId_companies_setnull";
      ALTER TABLE "credit_notes" DROP CONSTRAINT IF EXISTS "FK_credit_notes_companyId_companies_setnull";
      ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "FK_invoices_companyId_companies_setnull";
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_companyId_companies_default"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_notes"
      ADD CONSTRAINT "FK_credit_notes_companyId_companies_default"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "debit_notes"
      ADD CONSTRAINT "FK_debit_notes_companyId_companies_default"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences"
      ADD CONSTRAINT "FK_invoice_sequences_companyId_companies_default"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);

    // Only set NOT NULL if no null companyId values exist.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "invoices" WHERE "companyId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: invoices.companyId contains NULL values';
        END IF;
        IF EXISTS (SELECT 1 FROM "credit_notes" WHERE "companyId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: credit_notes.companyId contains NULL values';
        END IF;
        IF EXISTS (SELECT 1 FROM "debit_notes" WHERE "companyId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: debit_notes.companyId contains NULL values';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "companyId" SET NOT NULL;
      ALTER TABLE "credit_notes" ALTER COLUMN "companyId" SET NOT NULL;
      ALTER TABLE "debit_notes" ALTER COLUMN "companyId" SET NOT NULL;
    `);
  }
}

