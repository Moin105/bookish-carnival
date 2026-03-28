# Database Migrations

This directory contains database migrations for the ZATCA E-Invoicing system.

## Important Migration

### `1700000000000-AddInvoiceProtectionTriggers.ts`

This migration adds critical security protections:

1. **Invoice Update Protection Trigger**
   - Prevents any modification to issued/immutable invoices
   - Blocks changes to critical fields: hash, status, amounts, dates, etc.
   - Provides database-level protection against direct SQL manipulation

2. **Invoice Item Protection Triggers**
   - Prevents modification/deletion of invoice items when parent invoice is issued
   - Protects against cascade operations on immutable invoices

3. **Data Integrity Constraints**
   - Ensures `immutableFlag` and `status` are consistent
   - Requires `currentHash` to be set when invoice is issued
   - Prevents invalid state combinations

## Running Migrations

```bash
# Generate a new migration
npm run migration:generate -- -n MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Security Note

These migrations are critical for invoice integrity. Never skip or modify them in production.
