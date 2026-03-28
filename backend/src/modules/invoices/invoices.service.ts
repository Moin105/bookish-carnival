import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { QrCodeService } from '../../services/qr-code.service';
import { HashChainService } from '../../services/hash-chain.service';
import { InvoiceSequenceService } from '../../services/invoice-sequence.service';
import { XmlGeneratorService } from '../../services/xml-generator.service';
import { PuppeteerPdfService } from '../../services/puppeteer-pdf.service';
import { ZatcaSdkService, ZatcaValidationResult } from '../../services/zatca-sdk.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../entities/audit-log.entity';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private dataSource: DataSource,
    private qrCodeService: QrCodeService,
    private hashChainService: HashChainService,
    private invoiceSequenceService: InvoiceSequenceService,
    private xmlGeneratorService: XmlGeneratorService,
    private pdfService: PuppeteerPdfService,
    private zatcaSdkService: ZatcaSdkService,
    private auditLogsService: AuditLogsService,
    private configService: ConfigService,
  ) {}

  private buildCompanySnapshot(company: Company): Record<string, any> {
    return {
      id: company.id,
      name: company.name,
      vatNumber: company.vatNumber,
      commercialRegistration: company.commercialRegistration ?? null,
      address: company.address ?? null,
      streetName: company.streetName ?? null,
      buildingNumber: company.buildingNumber ?? null,
      plotIdentification: company.plotIdentification ?? null,
      citySubdivisionName: company.citySubdivisionName ?? null,
      city: company.city ?? null,
      postalCode: company.postalCode ?? null,
      country: company.country ?? null,
      phone: company.phone ?? null,
      email: company.email ?? null,
      website: company.website ?? null,
      logo: company.logo ?? null,
      isActive: company.isActive,
    };
  }

  private buildCustomerSnapshot(customer: Customer): Record<string, any> {
    return {
      id: customer.id,
      name: customer.name,
      vatNumber: customer.vatNumber ?? null,
      address: customer.address ?? null,
      streetName: customer.streetName ?? null,
      buildingNumber: customer.buildingNumber ?? null,
      plotIdentification: customer.plotIdentification ?? null,
      citySubdivisionName: customer.citySubdivisionName ?? null,
      city: customer.city ?? null,
      postalCode: customer.postalCode ?? null,
      country: customer.country ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      type: (customer as any).type ?? null,
      isActive: customer.isActive,
    };
  }

  private hydrateCompanyFromSnapshot(invoice: Invoice): Invoice {
    if (!invoice.company && invoice.companySnapshot) {
      (invoice as any).company = invoice.companySnapshot as any;
    }
    return invoice;
  }

  private hydrateCustomerFromSnapshot(invoice: Invoice): Invoice {
    if (!invoice.customer && invoice.customerSnapshot) {
      (invoice as any).customer = invoice.customerSnapshot as any;
    }
    return invoice;
  }

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    // Validate company and customer exist
    const company = await this.companyRepository.findOne({
      where: { id: createInvoiceDto.companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const customer = await this.customerRepository.findOne({
      where: { id: createInvoiceDto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate totals
    let subtotal = 0;
    const items = createInvoiceDto.items.map((itemDto) => {
      const vatRate = itemDto.vatRate || 15; // Default 15% VAT for Saudi Arabia
      const lineTotal = itemDto.quantity * itemDto.unitPrice;
      const vatAmount = (lineTotal * vatRate) / 100;
      subtotal += lineTotal;

      return this.invoiceItemRepository.create({
        name: itemDto.name,
        description: itemDto.description,
        quantity: itemDto.quantity,
        unitPrice: itemDto.unitPrice,
        vatRate,
        vatAmount,
        lineTotal: lineTotal + vatAmount,
      });
    });

    const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0);
    const totalAmount = subtotal + vatAmount;

    const issueDate = createInvoiceDto.issueDateTime
      ? new Date(createInvoiceDto.issueDateTime)
      : new Date();
    const dateKey = issueDate.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const generatedOrderNumber = `ORD-${dateKey}-${suffix}`;

    // ZATCA Phase 1: sequential per-company invoice number
    const invoiceNumber =
      createInvoiceDto.invoiceNumber ||
      (await this.invoiceSequenceService.getNextInvoiceNumber(createInvoiceDto.companyId));

    // Create invoice
    const invoice = this.invoiceRepository.create({
      invoiceNumber,
      issueDateTime: issueDate,
      companyId: createInvoiceDto.companyId,
      customerId: createInvoiceDto.customerId,
      // Always generate unique order number on backend (frontend should not control this).
      orderNumber: generatedOrderNumber,
      companySnapshot: this.buildCompanySnapshot(company),
      customerSnapshot: this.buildCustomerSnapshot(customer),
      subtotal,
      vatAmount,
      totalAmount,
      status: InvoiceStatus.DRAFT,
      items,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Log audit
    await this.auditLogsService.create({
      entityType: 'invoice',
      entityId: savedInvoice.id,
      action: AuditAction.CREATE,
      description: `Invoice ${invoiceNumber} created`,
    });

    return this.findOne(savedInvoice.id);
  }

  async findAll(): Promise<Invoice[]> {
    const invoices = await this.invoiceRepository.find({
      relations: ['company', 'customer', 'items'],
      order: { createdAt: 'DESC' },
    });
    return invoices
      .map((invoice) => this.hydrateCompanyFromSnapshot(invoice))
      .map((invoice) => this.hydrateCustomerFromSnapshot(invoice));
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['company', 'customer', 'items'],
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return this.hydrateCustomerFromSnapshot(this.hydrateCompanyFromSnapshot(invoice));
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(id);

    // Check immutability
    if (invoice.immutableFlag) {
      throw new BadRequestException('Invoice is immutable and cannot be modified');
    }

    if (invoice.status === InvoiceStatus.ISSUED) {
      throw new BadRequestException('Issued invoices cannot be modified');
    }

    // Explicitly prevent modification of protected fields that should never change
    const protectedFields = [
      'currentHash',
      'previousHash',
      'status',
      'immutableFlag',
      'invoiceNumber',
      'xmlContent',
      'xmlPath',
      'pdfPath',
      'qrCode',
      'qrCodeData',
    ];

    for (const field of protectedFields) {
      if ((updateInvoiceDto as any)[field] !== undefined) {
        throw new BadRequestException(
          `Field '${field}' is protected and cannot be modified directly`,
        );
      }
    }

    // Update items if provided
    if (updateInvoiceDto.items) {
      // Delete existing items
      await this.invoiceItemRepository.delete({ invoiceId: id });

      // Calculate new totals
      let subtotal = 0;
      const items = updateInvoiceDto.items.map((itemDto) => {
        const vatRate = itemDto.vatRate || 15;
        const lineTotal = itemDto.quantity * itemDto.unitPrice;
        const vatAmount = (lineTotal * vatRate) / 100;
        subtotal += lineTotal;

        return this.invoiceItemRepository.create({
          invoiceId: id,
          name: itemDto.name,
          description: itemDto.description,
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice,
          vatRate,
          vatAmount,
          lineTotal: lineTotal + vatAmount,
        });
      });

      const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0);
      const totalAmount = subtotal + vatAmount;

      invoice.subtotal = subtotal;
      invoice.vatAmount = vatAmount;
      invoice.totalAmount = totalAmount;
      invoice.items = await this.invoiceItemRepository.save(items);
    }

    // Update other fields
    if (updateInvoiceDto.issueDateTime) {
      invoice.issueDateTime = new Date(updateInvoiceDto.issueDateTime);
    }

    const updatedInvoice = await this.invoiceRepository.save(invoice);

    // Log audit
    await this.auditLogsService.create({
      entityType: 'invoice',
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Invoice ${invoice.invoiceNumber} updated`,
    });

    return this.findOne(updatedInvoice.id);
  }

  async issue(id: string, issueInvoiceDto: IssueInvoiceDto): Promise<Invoice> {
    try {
      const invoice = await this.findOne(id);

      if (invoice.status === InvoiceStatus.ISSUED) {
        throw new BadRequestException('Invoice is already issued');
      }

      if (invoice.immutableFlag) {
        throw new BadRequestException('Invoice is immutable');
      }

      if (!invoice.company && !invoice.companySnapshot) {
        throw new BadRequestException('Company information is missing');
      }

      if (!invoice.customer && !invoice.customerSnapshot) {
        throw new BadRequestException('Customer information is missing');
      }

      const company = (invoice.company ?? (invoice.companySnapshot as any)) as Company;
      const customer = (invoice.customer ?? (invoice.customerSnapshot as any)) as Customer;

      // Get previous hash for chaining (includes invoices and notes)
      const previousHash = await this.hashChainService.getPreviousDocumentHash(
        invoice.companyId,
      );

      // Generate current hash
      const currentHash = this.hashChainService.generateInvoiceHash(
        invoice,
        previousHash,
      );

      invoice.previousHash = previousHash;
      invoice.currentHash = currentHash;

      // Generate QR for both B2B and B2C.
      // (Existing qrCodeService produces TLV QR data; we persist it so the PDF can render it.)
      invoice.qrCode = null;
      invoice.qrCodeData = null;
      try {
        const qrCode = await this.qrCodeService.generateInvoiceQRCode(
          company.name,
          company.vatNumber,
          invoice.issueDateTime,
          invoice.totalAmount,
          invoice.vatAmount,
        );
        invoice.qrCode = qrCode.image;
        invoice.qrCodeData = qrCode.tlvData;
      } catch (error) {
        console.error('Error generating QR code:', error);
      }

      // ZATCA Phase 1: ProfileID 01 = standard (B2B), 02 = simplified (B2C)
      const profileID = customer.type === 'B2C' ? '02' : '01';
      const documentTypeLabel =
        customer.type === 'B2C' ? 'Simplified Tax Invoice' : 'Tax Invoice';

      // Generate XML with ProfileID and supplier/buyer address
      let xmlContent: string;
      try {
        xmlContent = this.xmlGeneratorService.generateUBLInvoice(
          invoice,
          company,
          customer,
          { profileID },
        );
        invoice.xmlContent = xmlContent;

        const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
        const xmlPath = path.join(
          storagePath,
          'xml',
          `${invoice.companyId}-${invoice.invoiceNumber}.xml`,
        );
        const xmlDir = path.dirname(xmlPath);
        if (!fs.existsSync(xmlDir)) {
          fs.mkdirSync(xmlDir, { recursive: true });
        }
        fs.writeFileSync(xmlPath, xmlContent, 'utf-8');
        invoice.xmlPath = xmlPath;

        // Optional: sign XML with ZATCA SDK (set ZATCA_SIGN_INVOICES=true to enable)
        const signEnabled = this.configService.get<string>('ZATCA_SIGN_INVOICES', 'false') === 'true';
        if (signEnabled && this.zatcaSdkService.isAvailable()) {
          const signResult = await this.zatcaSdkService.signInvoiceXml(xmlPath, xmlPath);
          if (signResult.success && signResult.signedPath && fs.existsSync(signResult.signedPath)) {
            invoice.xmlContent = fs.readFileSync(signResult.signedPath, 'utf-8');
          }
        }
      } catch (error) {
        console.error('Error generating XML:', error);
      }

      // Generate PDF with invoice type description
      try {
        const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
        const pdfPath = path.join(
          storagePath,
          'pdf',
          `${invoice.companyId}-${invoice.invoiceNumber}.pdf`,
        );
        const pdfDir = path.dirname(pdfPath);
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }
        const isSimplified = customer.type === 'B2C';
        const titleEn = isSimplified ? 'Simplified Tax Invoice' : 'Tax Invoice';
        const titleAr = isSimplified ? 'فاتورة ضريبية مبسطة' : 'فاتورة ضريبية';
        const { buffer } = await this.pdfService.generateInvoicePdf({
          invoice,
          company,
          customer,
          titleEn,
          titleAr,
        });
        await this.pdfService.writePdfToPath(buffer, pdfPath);
        invoice.pdfPath = pdfPath;
      } catch (error) {
        console.error('Error generating PDF:', error);
      }

      // Prepare all fields to update
      // Use update() instead of save() to bypass BeforeUpdate hook
      const updateData: any = {
        status: InvoiceStatus.ISSUED,
        immutableFlag: true,
        previousHash: previousHash,
        currentHash: currentHash,
      };

      updateData.qrCode = invoice.qrCode;
      updateData.qrCodeData = invoice.qrCodeData;

      if (invoice.xmlContent) {
        updateData.xmlContent = invoice.xmlContent;
      }

      if (invoice.xmlPath) {
        updateData.xmlPath = invoice.xmlPath;
      }

      if (invoice.pdfPath) {
        updateData.pdfPath = invoice.pdfPath;
      }

      // Use update() to bypass BeforeUpdate hook
      await this.invoiceRepository.update(id, updateData);

      // Fetch the updated invoice
      const issuedInvoice = await this.findOne(id);

      // Log audit
      try {
        await this.auditLogsService.create({
          entityType: 'invoice',
          entityId: id,
          action: AuditAction.ISSUE,
          description: `Invoice ${invoice.invoiceNumber} issued`,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: invoice.totalAmount,
            hash: currentHash,
          },
        });
      } catch (error) {
        console.error('Error creating audit log:', error);
        // Continue even if audit log fails
      }

      return issuedInvoice;
    } catch (error) {
      console.error('Error issuing invoice:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to issue invoice: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id);

    await this.invoiceRepository.remove(invoice);

    // Log audit
    await this.auditLogsService.create({
      entityType: 'invoice',
      entityId: id,
      action: AuditAction.DELETE,
      description: `Invoice ${invoice.invoiceNumber} deleted`,
    });
  }

  async validateHashChain(companyId: string): Promise<boolean> {
    return await this.hashChainService.validateHashChain(companyId);
  }

  /**
   * Validate an issued invoice's XML against ZATCA business rules using the local SDK CLI.
   * Requires ZATCA SDK JAR in backend/zatca-envoice-sdk-203/Apps/ and Java 21 or 22.
   * If the XML file is missing but xmlContent is stored, it is written to storage/xml first.
   */
  async validateWithZatcaSdk(id: string): Promise<ZatcaValidationResult> {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Only issued invoices can be validated with ZATCA SDK');
    }
    let xmlPath = invoice.xmlPath;
    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const expectedXmlPath = path.join(
      storagePath,
      'xml',
      `${invoice.companyId}-${invoice.invoiceNumber}.xml`,
    );

    if (!invoice.xmlContent) {
      throw new BadRequestException(
        'Invoice has no XML content. Re-issue the invoice to generate XML.',
      );
    }

    if (!xmlPath || !fs.existsSync(path.isAbsolute(xmlPath) ? xmlPath : path.resolve(xmlPath))) {
      const dir = path.dirname(expectedXmlPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(expectedXmlPath, invoice.xmlContent, 'utf-8');
      xmlPath = expectedXmlPath;
    }

    const absolutePath = path.isAbsolute(xmlPath) ? xmlPath : path.resolve(xmlPath);
    return this.zatcaSdkService.validateInvoiceXml(absolutePath);
  }

  async getInvoicePdfForDownload(id: string): Promise<{ absolutePath: string; filename: string }> {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('PDF is available only for issued invoices');
    }

    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const allowedDir = path.resolve(storagePath, 'pdf');
    const expectedPath = path.resolve(
      allowedDir,
      `${invoice.companyId}-${invoice.invoiceNumber}.pdf`,
    );
    const resolvedPath = invoice.pdfPath ? path.resolve(invoice.pdfPath) : expectedPath;
    if (!resolvedPath.startsWith(allowedDir + path.sep)) {
      throw new BadRequestException('Invalid PDF path');
    }

    // If missing, regenerate PDF for issued invoices (supports older records)
    if (!invoice.pdfPath || !fs.existsSync(resolvedPath)) {
      const dir = path.dirname(expectedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
        const customerForPdf = (invoice.customer ?? (invoice.customerSnapshot as any)) as Customer;
        if (!customerForPdf) {
          throw new BadRequestException('Customer information is missing for PDF generation');
        }
        const isSimplified = customerForPdf?.type === 'B2C';
        const titleEn = isSimplified ? 'Simplified Tax Invoice' : 'Tax Invoice';
        const titleAr = isSimplified ? 'فاتورة ضريبية مبسطة' : 'فاتورة ضريبية';
        const companyForPdf = (invoice.company ?? (invoice.companySnapshot as any)) as Company;
        if (!companyForPdf) {
          throw new BadRequestException('Company information is missing for PDF generation');
        }
        const { buffer } = await this.pdfService.generateInvoicePdf({
          invoice,
          company: companyForPdf,
          customer: customerForPdf,
          titleEn,
          titleAr,
        });
        await this.pdfService.writePdfToPath(buffer, expectedPath);
      await this.invoiceRepository.update(id, { pdfPath: expectedPath });
      if (!fs.existsSync(expectedPath)) {
        throw new NotFoundException('PDF file not found on disk');
      }
      return { absolutePath: expectedPath, filename: `${invoice.invoiceNumber}.pdf` };
    }
    return {
      absolutePath: resolvedPath,
      filename: `${invoice.invoiceNumber}.pdf`,
    };
  }

  /** Check if ZATCA SDK CLI is available for local validation. */
  isZatcaSdkAvailable(): boolean {
    return this.zatcaSdkService.isAvailable();
  }
}
