import { MigrationInterface, QueryRunner } from 'typeorm';

type UniqueTarget = {
  tableName: string;
  companyColumn: string;
  numberColumn: string;
  compositeIndexName: string;
};

export class AddCompositeUniqueInvoiceNumbers1770000000000
  implements MigrationInterface
{
  name = 'AddCompositeUniqueInvoiceNumbers1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ schema }] = await queryRunner.query(
      'SELECT current_schema() as schema',
    );

    const targets: UniqueTarget[] = [
      {
        tableName: 'invoices',
        companyColumn: 'companyId',
        numberColumn: 'invoiceNumber',
        compositeIndexName: 'UQ_invoices_companyId_invoiceNumber',
      },
      {
        tableName: 'credit_notes',
        companyColumn: 'companyId',
        numberColumn: 'noteNumber',
        compositeIndexName: 'UQ_credit_notes_companyId_noteNumber',
      },
      {
        tableName: 'debit_notes',
        companyColumn: 'companyId',
        numberColumn: 'noteNumber',
        compositeIndexName: 'UQ_debit_notes_companyId_noteNumber',
      },
    ];

    for (const t of targets) {
      // Drop any UNIQUE constraint that is only on the number column.
      const uniqueConstraintRows: Array<{ constraint_name: string }> =
        await queryRunner.query(
          `
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = $1
            AND tc.table_name = $2
            AND tc.constraint_type = 'UNIQUE'
            AND kcu.column_name = $3
          GROUP BY tc.constraint_name
          HAVING COUNT(*) = 1
          `,
          [schema, t.tableName, t.numberColumn],
        );

      for (const row of uniqueConstraintRows) {
        await queryRunner.query(
          `ALTER TABLE "${t.tableName}" DROP CONSTRAINT "${row.constraint_name}"`,
        );
      }

      // Add composite uniqueness scoped to company.
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${t.compositeIndexName}" ON "${t.tableName}" ("${t.companyColumn}", "${t.numberColumn}")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const targets: UniqueTarget[] = [
      {
        tableName: 'invoices',
        companyColumn: 'companyId',
        numberColumn: 'invoiceNumber',
        compositeIndexName: 'UQ_invoices_companyId_invoiceNumber',
      },
      {
        tableName: 'credit_notes',
        companyColumn: 'companyId',
        numberColumn: 'noteNumber',
        compositeIndexName: 'UQ_credit_notes_companyId_noteNumber',
      },
      {
        tableName: 'debit_notes',
        companyColumn: 'companyId',
        numberColumn: 'noteNumber',
        compositeIndexName: 'UQ_debit_notes_companyId_noteNumber',
      },
    ];

    for (const t of targets) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "${t.compositeIndexName}"`,
      );
      // Recreate the old global uniqueness. This may fail if multiple companies
      // already contain the same INV-/CN-/DN- number.
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${t.tableName}_${t.numberColumn}_key" ON "${t.tableName}" ("${t.numberColumn}")`,
      );
    }
  }
}

