# Security Measures - Invoice Manipulation Protection

This document outlines all security measures implemented to prevent invoice manipulation.

## Multi-Layer Protection System

The system implements **4 layers of protection** to ensure invoices cannot be manipulated after issuance:

### Layer 1: API-Level Protection (Service Layer)

**Location**: `backend/src/modules/invoices/invoices.service.ts`

- ✅ Checks `immutableFlag` before allowing updates
- ✅ Checks `status === ISSUED` before allowing modifications
- ✅ Validates protected fields cannot be modified directly
- ✅ Prevents deletion of issued invoices
- ✅ Blocks modification of invoice items when invoice is issued

**Protected Fields**:
- `currentHash`
- `previousHash`
- `status`
- `immutableFlag`
- `invoiceNumber`
- `xmlContent`
- `xmlPath`
- `pdfPath`
- `qrCode`
- `qrCodeData`

### Layer 2: Entity-Level Protection (ORM Hooks)

**Location**: 
- `backend/src/entities/invoice.entity.ts`
- `backend/src/entities/invoice-item.entity.ts`

- ✅ `@BeforeUpdate()` hook on Invoice entity prevents updates
- ✅ `@BeforeInsert()`, `@BeforeUpdate()`, `@BeforeRemove()` hooks on InvoiceItem entity
- ✅ Throws errors if modification attempted on immutable invoices

### Layer 3: Database-Level Protection (Triggers & Constraints)

**Location**: `backend/src/migrations/1700000000000-AddInvoiceProtectionTriggers.ts`

#### Database Triggers

1. **`invoice_update_protection` Trigger**
   - Fires BEFORE UPDATE on `invoices` table
   - Prevents modification of any critical field when `immutable_flag = true` or `status = 'issued'`
   - Blocks direct SQL updates bypassing application layer

2. **`invoice_item_update_protection` Trigger**
   - Fires BEFORE UPDATE on `invoice_items` table
   - Checks parent invoice status before allowing item updates

3. **`invoice_item_delete_protection` Trigger**
   - Fires BEFORE DELETE on `invoice_items` table
   - Prevents deletion of items when parent invoice is issued

#### Database Constraints

1. **`check_immutable_integrity` Constraint**
   - Ensures data consistency: `immutable_flag` and `status` must be consistent
   - Valid combinations:
     - `immutable_flag = false` AND `status = 'draft'`
     - `immutable_flag = true` AND `status = 'issued'`
     - `status = 'cancelled'` (any immutable_flag value)

2. **`check_hash_on_issued` Constraint**
   - Requires `current_hash` to be NOT NULL when `status = 'issued'`
   - Ensures hash is always set for issued invoices

### Layer 4: Hash Chain Validation

**Location**: `backend/src/services/hash-chain.service.ts`

- ✅ SHA-256 hash generation for each invoice
- ✅ Hash chaining: each invoice hash includes previous invoice hash
- ✅ Chain validation endpoint: `/invoices/validate-hash-chain/:companyId`
- ✅ Detects tampering by validating entire chain integrity

## How It Works

### Invoice Lifecycle

1. **Draft Stage**
   - Invoice created with `status = 'draft'` and `immutableFlag = false`
   - Can be modified freely through API
   - All protection layers allow modifications

2. **Issuance Stage**
   - User calls `PUT /invoices/:id/issue`
   - System:
     - Generates QR code (if B2C)
     - Generates UBL 2.1 XML
     - Generates PDF
     - Creates hash chain link
     - Sets `status = 'issued'` and `immutableFlag = true`
   - Invoice becomes immutable

3. **After Issuance**
   - **API Layer**: Blocks all update/delete operations
   - **Entity Layer**: `@BeforeUpdate()` hook throws error
   - **Database Layer**: Triggers prevent SQL updates
   - **Hash Chain**: Any modification breaks the chain (detectable)

## Testing Security

### Test 1: API-Level Protection
```bash
# Try to update an issued invoice via API
curl -X PATCH http://localhost:3001/invoices/{id} \
  -H "Content-Type: application/json" \
  -d '{"subtotal": 999}'
# Expected: 400 Bad Request - "Invoice is immutable and cannot be modified"
```

### Test 2: Database-Level Protection
```sql
-- Try to update directly in database
UPDATE invoices 
SET subtotal = 999 
WHERE id = 'some-issued-invoice-id';
-- Expected: ERROR - "Cannot modify issued invoice"
```

### Test 3: Hash Chain Validation
```bash
# Validate hash chain integrity
curl http://localhost:3001/invoices/validate-hash-chain/{companyId}
# Expected: {"valid": true} or {"valid": false} if tampering detected
```

## Security Best Practices

1. **Always run migrations** before deploying to production
2. **Never disable triggers** in production database
3. **Regular hash chain validation** - schedule periodic checks
4. **Monitor audit logs** for suspicious activity
5. **Database backups** - maintain immutable backups of issued invoices
6. **Access control** - limit database access to prevent direct SQL manipulation
7. **Network security** - secure database connections

## Bypass Prevention

### What Prevents Bypass:

✅ **Direct SQL Updates**: Database triggers block modifications
✅ **ORM Bypass**: Entity hooks catch modifications before save
✅ **API Bypass**: Service layer validates before processing
✅ **Field Manipulation**: Protected fields list prevents direct changes
✅ **Item Manipulation**: Invoice items protected when parent is immutable

### What Cannot Be Bypassed:

- Database triggers execute at the database level (cannot be bypassed by application)
- Constraints enforce data integrity at schema level
- Hash chain detects any tampering even if other protections fail

## Incident Response

If invoice manipulation is detected:

1. **Immediate Actions**:
   - Check hash chain validation: `GET /invoices/validate-hash-chain/:companyId`
   - Review audit logs for the affected invoice
   - Identify which protection layer was bypassed (if any)

2. **Investigation**:
   - Check database logs for trigger violations
   - Review application logs for errors
   - Examine audit trail

3. **Remediation**:
   - Restore from backup if tampering confirmed
   - Regenerate affected invoices if necessary
   - Review and strengthen security if gap found

## Compliance

These security measures ensure compliance with:
- ✅ ZATCA Phase 1 requirements (invoice immutability)
- ✅ Audit readiness (tamper detection)
- ✅ Data integrity (hash chaining)
- ✅ Regulatory compliance (no modification after issuance)

## Additional Recommendations

For enhanced security in production:

1. **Database User Permissions**: Create read-only users for reporting
2. **Application Logging**: Log all invoice operations
3. **Monitoring**: Set up alerts for trigger violations
4. **Backup Strategy**: Regular immutable backups
5. **Access Auditing**: Track who accesses invoice data
6. **Encryption**: Encrypt sensitive invoice data at rest
