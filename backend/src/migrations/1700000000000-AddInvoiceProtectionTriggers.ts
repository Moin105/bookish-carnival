import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceProtectionTriggers1700000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create function to prevent invoice modification after issuance
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Prevent any modification to issued/immutable invoices
        IF OLD."immutableFlag" = true OR OLD.status = 'issued' THEN
          -- Allow only update to updatedAt timestamp (automatic)
          IF (
            NEW."immutableFlag" != OLD."immutableFlag" OR
            NEW.status != OLD.status OR
            NEW."currentHash" != OLD."currentHash" OR
            NEW."previousHash" != OLD."previousHash" OR
            NEW."invoiceNumber" != OLD."invoiceNumber" OR
            NEW."issueDateTime" != OLD."issueDateTime" OR
            NEW.subtotal != OLD.subtotal OR
            NEW."vatAmount" != OLD."vatAmount" OR
            NEW."totalAmount" != OLD."totalAmount" OR
            NEW."companyId" != OLD."companyId" OR
            NEW."customerId" != OLD."customerId" OR
            NEW."xmlContent" != OLD."xmlContent" OR
            NEW."xmlPath" != OLD."xmlPath" OR
            NEW."pdfPath" != OLD."pdfPath" OR
            NEW."qrCode" != OLD."qrCode" OR
            NEW."qrCodeData" != OLD."qrCodeData"
          ) THEN
            RAISE EXCEPTION 'Cannot modify issued invoice. Invoice ID: %, Invoice Number: %', OLD.id, OLD."invoiceNumber";
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for invoice table
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_update_protection ON invoices;
      CREATE TRIGGER invoice_update_protection
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION prevent_invoice_modification();
    `);

    // Create function to prevent invoice item modification after invoice issuance
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_item_modification()
      RETURNS TRIGGER AS $$
      DECLARE
        invoice_immutable BOOLEAN;
        invoice_status VARCHAR;
      BEGIN
        -- Check if parent invoice is immutable or issued
        SELECT "immutableFlag", status INTO invoice_immutable, invoice_status
        FROM invoices
        WHERE id = COALESCE(NEW."invoiceId", OLD."invoiceId");

        IF invoice_immutable = true OR invoice_status = 'issued' THEN
          RAISE EXCEPTION 'Cannot modify items of issued invoice. Invoice ID: %', COALESCE(NEW."invoiceId", OLD."invoiceId");
        END IF;

        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for invoice_items table (UPDATE)
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_item_update_protection ON invoice_items;
      CREATE TRIGGER invoice_item_update_protection
      BEFORE UPDATE ON invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION prevent_invoice_item_modification();
    `);

    // Create trigger for invoice_items table (DELETE)
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_item_delete_protection ON invoice_items;
      CREATE TRIGGER invoice_item_delete_protection
      BEFORE DELETE ON invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION prevent_invoice_item_modification();
    `);

    // Add CHECK constraint to ensure data integrity
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_immutable_integrity;
      
      ALTER TABLE invoices
      ADD CONSTRAINT check_immutable_integrity
      CHECK (
        ("immutableFlag" = false AND status = 'draft') OR
        ("immutableFlag" = true AND status = 'issued') OR
        (status = 'cancelled')
      );
    `);

    // Add constraint to ensure currentHash is set when invoice is issued
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_hash_on_issued;
      
      ALTER TABLE invoices
      ADD CONSTRAINT check_hash_on_issued
      CHECK (
        (status != 'issued' OR "currentHash" IS NOT NULL)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_update_protection ON invoices;
      DROP TRIGGER IF EXISTS invoice_item_update_protection ON invoice_items;
      DROP TRIGGER IF EXISTS invoice_item_delete_protection ON invoice_items;
    `);

    // Drop functions
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS prevent_invoice_modification();
      DROP FUNCTION IF EXISTS prevent_invoice_item_modification();
    `);

    // Drop constraints
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_immutable_integrity;
      
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_hash_on_issued;
    `);
  }
}
