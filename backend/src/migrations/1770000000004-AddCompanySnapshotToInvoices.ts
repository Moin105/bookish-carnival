import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanySnapshotToInvoices1770000000004 implements MigrationInterface {
  name = 'AddCompanySnapshotToInvoices1770000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "companySnapshot" jsonb;
    `);

    await queryRunner.query(`
      UPDATE "invoices" i
      SET "companySnapshot" = jsonb_build_object(
        'id', c."id",
        'name', c."name",
        'vatNumber', c."vatNumber",
        'commercialRegistration', c."commercialRegistration",
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
        'website', c."website",
        'logo', c."logo",
        'isActive', c."isActive"
      )
      FROM "companies" c
      WHERE i."companyId" = c."id"
        AND i."companySnapshot" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "companySnapshot";
    `);
  }
}

