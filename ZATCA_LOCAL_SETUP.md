# ZATCA-Compliant Local Setup (Phase 1)

This document describes how the project meets ZATCA e-invoicing **Phase 1 (Generation Phase)** requirements for local operation and how to use the ZATCA SDK.

---

## 1. Phase 1 Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| UBL 2.1 XML | ✅ | `XmlGeneratorService` – tax invoice (388), credit note (381), debit note (383) |
| ProfileID (01 standard / 02 simplified) | ✅ | Set from customer type (B2B/B2C) in UBL and PDF |
| Invoice type description on PDF | ✅ | "Tax Invoice" / "Simplified Tax Invoice" / "Credit Note" / "Debit Note" |
| Supplier (seller) PostalAddress in UBL | ✅ | StreetName, BuildingNumber, PlotIdentification, CitySubdivisionName, CityName, PostalZone, Country |
| Buyer (customer) PostalAddress in UBL | ✅ | Same structure from customer entity |
| QR code (B2C simplified) | ✅ | TLV with seller name, VAT number, timestamp, total, VAT amount |
| Credit and debit notes | ✅ | Entities, API, UBL 381/383, BillingReference to original invoice |
| Sequential numbering | ✅ | Per-company: INV-1, INV-2…; CN-1, CN-2…; DN-1, DN-2… via `InvoiceSequence` |
| Tamper-proof storage | ✅ | Hash chain across invoices and notes, `immutableFlag`, no delete of issued docs |
| Optional XML signing | ✅ | Set `ZATCA_SIGN_INVOICES=true`; SDK `-sign` used after XML write (cert/keys in SDK) |
| ZATCA SDK validation | ✅ | `GET /invoices/:id/validate-zatca` and CLI `npm run zatca:validate` |

---

## 2. System Requirements

### XML Generation (UBL 2.1)
- **Tax invoice (388):** `XmlGeneratorService.generateUBLInvoice()` with ProfileID 01 (B2B) or 02 (B2C).
- **Credit note (381):** `generateUBLCreditNote()` with BillingReference to original invoice.
- **Debit note (383):** `generateUBLDebitNote()` with BillingReference to original invoice.
- Supplier and customer **PostalAddress** include: StreetName, BuildingNumber, PlotIdentification, CitySubdivisionName, CityName, PostalZone, Country (ZATCA-required fields supported).

### Company and Customer Address (ZATCA)
- **Company:** In addition to address/city/postalCode/country, use: `streetName`, `buildingNumber`, `plotIdentification`, `citySubdivisionName` (e.g. for UBL and compliance).
- **Customer:** Same optional fields for buyer address in UBL.
- Frontend: company create form includes these fields; use them when creating/editing companies.

### QR Code
- For **B2C** invoices and notes: TLV QR with seller name, VAT number, timestamp, invoice total, VAT amount (Base64). Same for credit/debit notes when customer is B2C.

### Tamper-Proof Storage
- **PostgreSQL** stores all documents. Issued invoices and notes are **immutable** and cannot be deleted.
- **Hash chain:** `HashChainService` chains the latest issued document (invoice, credit note, or debit note) per company; `getPreviousDocumentHash()` and `validateHashChain()` include all three types.

---

## 3. Credit and Debit Notes

- **API:** `POST /credit-notes`, `POST /debit-notes` (body: `originalInvoiceId`, `reason?`, `items[]`).  
  `GET /credit-notes`, `GET /credit-notes/by-invoice/:invoiceId`, `GET /credit-notes/:id`, `POST /credit-notes/:id/issue`, `DELETE /credit-notes/:id` (draft only).  
  Same pattern for `/debit-notes`.
- **Numbering:** Sequential per company: CN-1, CN-2… and DN-1, DN-2…
- **UBL:** Type 381 (credit), 383 (debit), with `cac:BillingReference` to the original invoice.
- **Frontend:** Invoice detail (issued) shows “Issue Credit Note” / “Issue Debit Note”. List and detail pages for credit and debit notes; create flows from invoice with pre-filled items.

---

## 4. Sequential Numbering

- **Invoices:** `INV-1`, `INV-2`, … per company (no more random/timestamp-based numbers).
- **Credit notes:** `CN-1`, `CN-2`, … per company.
- **Debit notes:** `DN-1`, `DN-2`, … per company.
- Stored in `invoice_sequences` (one row per company: `lastInvoiceNumber`, `lastCreditNoteNumber`, `lastDebitNoteNumber`). `InvoiceSequenceService` returns the next number in a transaction.

---

## 5. ZATCA SDK: Validation and Signing

### Prerequisites
- **Java 21 or 22** on `PATH`.
- **SDK JAR** in `backend/zatca-envoice-sdk-203/Apps/cli-3.0.8-jar-with-dependencies.jar` (or version in `Apps/global.json`).

### Validation
- **API:** `GET /invoices/zatca-sdk/available`, `GET /invoices/:id/validate-zatca`.
- **CLI:** `npm run zatca:validate -- storage/xml/INV-1.xml` (or `node scripts/validate-zatca-xml.js <path>`).

### Signing (optional)
- Set in `.env`: `ZATCA_SIGN_INVOICES=true`.
- On issue, after writing the UBL XML file, the app calls the SDK with `-sign -invoice <path> -signedInvoice <path>`. Signed XML overwrites the file and is stored in DB.
- **Certificates:** Place cert and private key in `backend/zatca-envoice-sdk-203/Data/Certificates/` (e.g. `cert.pem`, `ec-secp256k1-priv-key.pem`) as expected by the SDK. Password in `Apps/global.json` (`certPassword`). See ZATCA portal for generating/compliance certificates.

---

## 6. Running the Stack Locally

- **Backend:** `cd backend` then `npm run start` or `npm run start:dev`. Uses PostgreSQL from `.env`; sync creates tables (including `invoice_sequences`, `credit_notes`, `debit_notes`, etc.).
- **Frontend:** Run Next.js (e.g. `npm run dev` in `frontend`). Dashboard and menus can link to Invoices, Credit Notes, Debit Notes, Companies.
- **Database:** Local PostgreSQL; connection in `backend/.env` and `database.config.ts`.

---

## 7. Summary

- **Phase 1** coverage: UBL 2.1 with ProfileID and invoice type description, supplier/buyer address, QR for B2C, credit/debit notes (381/383), sequential numbering, tamper-proof chain, optional signing, and SDK validation.
- **New/updated:** Company and customer address fields, credit/debit note APIs and UI, invoice type on PDF, signing flag and SDK signing step, and `ZATCA_LOCAL_SETUP.md` (this file).
