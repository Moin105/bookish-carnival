import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { Invoice } from '../entities/invoice.entity';
import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { DebitNote } from '../entities/debit-note.entity';

export interface UBLGenerationOptions {
  /** ZATCA: 388 Tax Invoice, 381 Credit Note, 383 Debit Note */
  invoiceTypeCode: string;
  /** ZATCA: 01 Standard (B2B), 02 Simplified (B2C) */
  profileID: string;
  /** For credit/debit notes: original invoice number */
  billingReferenceInvoiceId?: string;
}

export interface DocumentLike {
  invoiceNumber?: string;
  noteNumber?: string;
  issueDateTime: Date;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    vatAmount: number;
    lineTotal: number;
  }>;
}

@Injectable()
export class XmlGeneratorService {
  /**
   * Generate UBL 2.1 XML for tax invoice (388). Profile 01 = standard, 02 = simplified.
   */
  generateUBLInvoice(
    invoice: Invoice,
    company: Company,
    customer: Customer,
    options?: Partial<UBLGenerationOptions>,
  ): string {
    const profileID = options?.profileID ?? (customer.type === 'B2C' ? '02' : '01');
    return this.buildUBL(
      {
        invoiceNumber: invoice.invoiceNumber,
        issueDateTime: invoice.issueDateTime,
        subtotal: Number(invoice.subtotal),
        vatAmount: Number(invoice.vatAmount),
        totalAmount: Number(invoice.totalAmount),
        items: invoice.items || [],
      },
      company,
      customer,
      {
        invoiceTypeCode: options?.invoiceTypeCode ?? '388',
        profileID,
        billingReferenceInvoiceId: options?.billingReferenceInvoiceId,
      },
    );
  }

  /**
   * Generate UBL 2.1 XML for credit note (381).
   */
  generateUBLCreditNote(
    note: CreditNote,
    company: Company,
    customer: Customer,
  ): string {
    const profileID = customer.type === 'B2C' ? '02' : '01';
    return this.buildUBL(
      {
        noteNumber: note.noteNumber,
        issueDateTime: note.issueDateTime,
        subtotal: Number(note.subtotal),
        vatAmount: Number(note.vatAmount),
        totalAmount: Number(note.totalAmount),
        items: note.items || [],
      },
      company,
      customer,
      {
        invoiceTypeCode: '381',
        profileID,
        billingReferenceInvoiceId: note.originalInvoice?.invoiceNumber,
      },
    );
  }

  /**
   * Generate UBL 2.1 XML for debit note (383).
   */
  generateUBLDebitNote(
    note: DebitNote,
    company: Company,
    customer: Customer,
  ): string {
    const profileID = customer.type === 'B2C' ? '02' : '01';
    return this.buildUBL(
      {
        noteNumber: note.noteNumber,
        issueDateTime: note.issueDateTime,
        subtotal: Number(note.subtotal),
        vatAmount: Number(note.vatAmount),
        totalAmount: Number(note.totalAmount),
        items: note.items || [],
      },
      company,
      customer,
      {
        invoiceTypeCode: '383',
        profileID,
        billingReferenceInvoiceId: note.originalInvoice?.invoiceNumber,
      },
    );
  }

  private getDocId(doc: DocumentLike): string {
    return (doc as any).invoiceNumber ?? (doc as any).noteNumber ?? '';
  }

  private buildUBL(
    doc: DocumentLike,
    company: Company,
    customer: Customer,
    options: UBLGenerationOptions,
  ): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      });

    const ext = root.ele('ext:UBLExtensions').ele('ext:UBLExtension');
    ext.ele('ext:ExtensionContent');

    root.ele('cbc:UBLVersionID').txt('2.1');
    root.ele('cbc:CustomizationID').txt('urn:zatca:customization:vat-invoice-sa:1.0');
    root.ele('cbc:ProfileID').txt(options.profileID);

    root.ele('cbc:ID').txt(this.getDocId(doc));

    root.ele('cbc:IssueDate').txt(
      doc.issueDateTime.toISOString().split('T')[0],
    );
    root.ele('cbc:IssueTime').txt(
      doc.issueDateTime.toISOString().split('T')[1].split('.')[0],
    );

    if (options.billingReferenceInvoiceId) {
      const billingRef = root.ele('cac:BillingReference');
      billingRef.ele('cac:InvoiceDocumentReference').ele('cbc:ID').txt(options.billingReferenceInvoiceId);
    }

    root.ele('cbc:InvoiceTypeCode').txt(options.invoiceTypeCode);
    root.ele('cbc:DocumentCurrencyCode').txt('SAR');

    // Accounting Supplier Party with PostalAddress (ZATCA required)
    const supplierParty = root.ele('cac:AccountingSupplierParty');
    const supplierPartyParty = supplierParty.ele('cac:Party');
    supplierPartyParty.ele('cac:PartyName').ele('cbc:Name').txt(company.name);

    this.addPostalAddress(supplierPartyParty, {
      streetName: company.streetName || company.address,
      buildingNumber: company.buildingNumber,
      plotIdentification: company.plotIdentification,
      citySubdivisionName: company.citySubdivisionName,
      cityName: company.city,
      postalZone: company.postalCode,
      countryCode: company.country || 'SA',
    });

    const supplierTax = supplierPartyParty.ele('cac:PartyTaxScheme');
    supplierTax.ele('cbc:CompanyID').txt(company.vatNumber);
    supplierTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    // Accounting Customer Party with PostalAddress
    const customerParty = root.ele('cac:AccountingCustomerParty');
    const customerPartyParty = customerParty.ele('cac:Party');
    customerPartyParty.ele('cac:PartyName').ele('cbc:Name').txt(customer.name);

    this.addPostalAddress(customerPartyParty, {
      streetName: customer.streetName || customer.address,
      buildingNumber: customer.buildingNumber,
      plotIdentification: customer.plotIdentification,
      citySubdivisionName: customer.citySubdivisionName,
      cityName: customer.city,
      postalZone: customer.postalCode,
      countryCode: customer.country || 'SA',
    });

    if (customer.vatNumber) {
      const customerTax = customerPartyParty.ele('cac:PartyTaxScheme');
      customerTax.ele('cbc:CompanyID').txt(customer.vatNumber);
      customerTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');
    }

    // Invoice Lines
    doc.items.forEach((item, index) => {
      const line = root.ele('cac:InvoiceLine');
      line.ele('cbc:ID').txt((index + 1).toString());
      const lineExtension = item.quantity * item.unitPrice;
      line.ele('cbc:InvoicedQuantity', { unitCode: 'C62' }).txt(item.quantity.toString());
      line.ele('cbc:LineExtensionAmount', { currencyID: 'SAR' }).txt(lineExtension.toFixed(2));

      const itemEl = line.ele('cac:Item');
      itemEl.ele('cbc:Name').txt(item.name);
      if (item.description) {
        itemEl.ele('cbc:Description').txt(item.description);
      }

      const price = line.ele('cac:Price');
      price.ele('cbc:PriceAmount', { currencyID: 'SAR' }).txt(item.unitPrice.toFixed(2));

      const taxTotal = line.ele('cac:TaxTotal');
      taxTotal.ele('cbc:TaxAmount', { currencyID: 'SAR' }).txt(item.vatAmount.toFixed(2));
      const taxCat = taxTotal.ele('cac:TaxSubtotal').ele('cac:TaxCategory');
      taxCat.ele('cbc:ID').txt('S');
      taxCat.ele('cbc:Percent').txt(String(item.vatRate));
      taxCat.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');
    });

    const legalMonetaryTotal = root.ele('cac:LegalMonetaryTotal');
    legalMonetaryTotal.ele('cbc:LineExtensionAmount', { currencyID: 'SAR' }).txt(doc.subtotal.toFixed(2));
    legalMonetaryTotal.ele('cbc:TaxExclusiveAmount', { currencyID: 'SAR' }).txt(doc.subtotal.toFixed(2));
    legalMonetaryTotal.ele('cbc:TaxInclusiveAmount', { currencyID: 'SAR' }).txt(doc.totalAmount.toFixed(2));
    legalMonetaryTotal.ele('cbc:PayableAmount', { currencyID: 'SAR' }).txt(doc.totalAmount.toFixed(2));

    const taxTotal = root.ele('cac:TaxTotal');
    taxTotal.ele('cbc:TaxAmount', { currencyID: 'SAR' }).txt(doc.vatAmount.toFixed(2));
    const taxCat = taxTotal.ele('cac:TaxSubtotal').ele('cac:TaxCategory');
    taxCat.ele('cbc:ID').txt('S');
    taxCat.ele('cbc:Percent').txt('15');
    taxCat.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    return root.end({ prettyPrint: true });
  }

  private addPostalAddress(
    party: ReturnType<ReturnType<typeof create>['ele']>,
    addr: {
      streetName?: string;
      buildingNumber?: string;
      plotIdentification?: string;
      citySubdivisionName?: string;
      cityName?: string;
      postalZone?: string;
      countryCode?: string;
    },
  ): void {
    const postal = party.ele('cac:PostalAddress');
    if (addr.streetName) {
      postal.ele('cbc:StreetName').txt(addr.streetName);
    }
    if (addr.buildingNumber) {
      postal.ele('cbc:BuildingNumber').txt(addr.buildingNumber);
    }
    if (addr.plotIdentification) {
      postal.ele('cbc:PlotIdentification').txt(addr.plotIdentification);
    }
    if (addr.citySubdivisionName) {
      postal.ele('cbc:CitySubdivisionName').txt(addr.citySubdivisionName);
    }
    if (addr.cityName) {
      postal.ele('cbc:CityName').txt(addr.cityName);
    }
    if (addr.postalZone) {
      postal.ele('cbc:PostalZone').txt(addr.postalZone);
    }
    const countryCode = (addr.countryCode || 'SA').replace(/^SA$/i, 'SA');
    postal.ele('cac:Country').ele('cbc:IdentificationCode').txt(countryCode);
  }
}
