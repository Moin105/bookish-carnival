import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowCustomerDeleteKeepInvoiceData1770000000005 implements MigrationInterface {
  name = 'AllowCustomerDeleteKeepInvoiceData1770000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "customerSnapshot" jsonb;
    `);

    await queryRunner.query(`
      UPDATE "invoices" i
      SET "customerSnapshot" = jsonb_build_object(
        'id', c."id",
        'name', c."name",
        'vatNumber', c."vatNumber",
        'address', c."address",
        'streetName', c."streetName",
        'buildingNumber', c."buildingNumber",
        'plotIdentification', c."plotIdentification",
        'citySubdivisionName', c."citySubdivisionName",
        'city', c."city",
        'postalCode', c."postalCode",
        'country', c."country",
        'phone', c."phone",
        'email', c."email",
        'type', c."type",
        'isActive', c."isActive"
      )
      FROM "customers" c
      WHERE i."customerId" = c."id"
        AND i."customerSnapshot" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "customerId" DROP NOT NULL;
      ALTER TABLE "credit_notes" ALTER COLUMN "customerId" DROP NOT NULL;
      ALTER TABLE "debit_notes" ALTER COLUMN "customerId" DROP NOT NULL;
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
            AND kcu.column_name = 'customerId'
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
            AND kcu.column_name = 'customerId'
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
            AND kcu.column_name = 'customerId'
        LOOP
          EXECUTE format('ALTER TABLE "debit_notes" DROP CONSTRAINT %I', r.constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_customerId_customers_setnull"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_notes"
      ADD CONSTRAINT "FK_credit_notes_customerId_customers_setnull"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "debit_notes"
      ADD CONSTRAINT "FK_debit_notes_customerId_customers_setnull"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "debit_notes" DROP CONSTRAINT IF EXISTS "FK_debit_notes_customerId_customers_setnull";
      ALTER TABLE "credit_notes" DROP CONSTRAINT IF EXISTS "FK_credit_notes_customerId_customers_setnull";
      ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "FK_invoices_customerId_customers_setnull";
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_customerId_customers_default"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_notes"
      ADD CONSTRAINT "FK_credit_notes_customerId_customers_default"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "debit_notes"
      ADD CONSTRAINT "FK_debit_notes_customerId_customers_default"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "invoices" WHERE "customerId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: invoices.customerId contains NULL values';
        END IF;
        IF EXISTS (SELECT 1 FROM "credit_notes" WHERE "customerId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: credit_notes.customerId contains NULL values';
        END IF;
        IF EXISTS (SELECT 1 FROM "debit_notes" WHERE "customerId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: debit_notes.customerId contains NULL values';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "customerId" SET NOT NULL;
      ALTER TABLE "credit_notes" ALTER COLUMN "customerId" SET NOT NULL;
      ALTER TABLE "debit_notes" ALTER COLUMN "customerId" SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN IF EXISTS "customerSnapshot";
    `);
  }
}

