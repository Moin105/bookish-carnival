import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditNote, CreditNoteStatus } from '../../entities/credit-note.entity';
import { CreditNoteItem } from '../../entities/credit-note-item.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { QrCodeService } from '../../services/qr-code.service';
import { HashChainService } from '../../services/hash-chain.service';
import { InvoiceSequenceService } from '../../services/invoice-sequence.service';
import { XmlGeneratorService } from '../../services/xml-generator.service';
import { PuppeteerPdfService } from '../../services/puppeteer-pdf.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../entities/audit-log.entity';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreditNotesService {
  constructor(
    @InjectRepository(CreditNote)
    private creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(CreditNoteItem)
    private creditNoteItemRepository: Repository<CreditNoteItem>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private qrCodeService: QrCodeService,
    private hashChainService: HashChainService,
    private invoiceSequenceService: InvoiceSequenceService,
    private xmlGeneratorService: XmlGeneratorService,
    private pdfService: PuppeteerPdfService,
    private auditLogsService: AuditLogsService,
    private configService: ConfigService,
  ) {}

  async create(dto: CreateCreditNoteDto): Promise<CreditNote> {
    const originalInvoice = await this.invoiceRepository.findOne({
      where: { id: dto.originalInvoiceId },
      relations: ['company', 'customer'],
    });
    if (!originalInvoice) {
      throw new NotFoundException('Original invoice not found');
    }
    if (originalInvoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Credit note can only be created for an issued invoice');
    }

    const company = originalInvoice.company;
    const customer = originalInvoice.customer;

    let subtotal = 0;
    const items = dto.items.map((itemDto) => {
      const vatRate = itemDto.vatRate ?? 15;
      const lineTotal = itemDto.quantity * itemDto.unitPrice;
      const vatAmount = (lineTotal * vatRate) / 100;
      subtotal += lineTotal;
      return this.creditNoteItemRepository.create({
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

    const noteNumber = await this.invoiceSequenceService.getNextCreditNoteNumber(company.id);

    const note = this.creditNoteRepository.create({
      noteNumber,
      issueDateTime: new Date(),
      companyId: company.id,
      customerId: customer.id,
      originalInvoiceId: originalInvoice.id,
      reason: dto.reason,
      subtotal,
      vatAmount,
      totalAmount,
      status: CreditNoteStatus.DRAFT,
      items,
    });

    const saved = await this.creditNoteRepository.save(note);
    await this.auditLogsService.create({
      entityType: 'credit_note',
      entityId: saved.id,
      action: AuditAction.CREATE,
      description: `Credit note ${noteNumber} created`,
    });
    return this.findOne(saved.id);
  }

  async findAll(): Promise<CreditNote[]> {
    return this.creditNoteRepository.find({
      relations: ['company', 'customer', 'originalInvoice', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<CreditNote> {
    const note = await this.creditNoteRepository.findOne({
      where: { id },
      relations: ['company', 'customer', 'originalInvoice', 'items'],
    });
    if (!note) throw new NotFoundException(`Credit note ${id} not found`);
    return note;
  }

  async findByInvoiceId(invoiceId: string): Promise<CreditNote[]> {
    return this.creditNoteRepository.find({
      where: { originalInvoiceId: invoiceId },
      relations: ['company', 'customer', 'originalInvoice', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    const note = await this.findOne(id);
    if (note.status === CreditNoteStatus.ISSUED || note.immutableFlag) {
      throw new BadRequestException('Issued credit notes cannot be deleted');
    }
    await this.creditNoteRepository.remove(note);
    await this.auditLogsService.create({
      entityType: 'credit_note',
      entityId: id,
      action: AuditAction.DELETE,
      description: `Credit note ${note.noteNumber} deleted`,
    });
  }

  async issue(id: string): Promise<CreditNote> {
    const note = await this.findOne(id);
    if (note.status === CreditNoteStatus.ISSUED) {
      throw new BadRequestException('Credit note is already issued');
    }

    const company = note.company;
    const customer = note.customer;
    if (!company || !customer) {
      throw new BadRequestException('Company or customer missing');
    }

    const previousHash = await this.hashChainService.getPreviousDocumentHash(note.companyId);
    const currentHash = this.hashChainService.generateCreditNoteHash(note, previousHash);
    note.previousHash = previousHash;
    note.currentHash = currentHash;

    // Generate QR for both B2B and B2C so PDF rendering includes it.
    note.qrCode = null;
    note.qrCodeData = null;
    try {
      const qr = await this.qrCodeService.generateInvoiceQRCode(
        company.name,
        company.vatNumber,
        note.issueDateTime,
        Number(note.totalAmount),
        Number(note.vatAmount),
      );
      note.qrCode = qr.image;
      note.qrCodeData = qr.tlvData;
    } catch (e) {
      console.error('Credit note QR error:', e);
    }

    let xmlContent = this.xmlGeneratorService.generateUBLCreditNote(note, company, customer);
    note.xmlContent = xmlContent;

    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const xmlPath = path.join(
      storagePath,
      'xml',
      `${note.companyId}-${note.noteNumber}.xml`,
    );
    const xmlDir = path.dirname(xmlPath);
    if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(xmlPath, xmlContent, 'utf-8');
    note.xmlPath = xmlPath;

    const pdfPath = path.join(
      storagePath,
      'pdf',
      `${note.companyId}-${note.noteNumber}.pdf`,
    );
    const pdfDir = path.dirname(pdfPath);
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    // Reuse the invoice-style template for notes (bilingual ZATCA-style)
    const fakeInvoice: any = {
      invoiceNumber: note.noteNumber,
      issueDateTime: note.issueDateTime,
      subtotal: note.subtotal,
      vatAmount: note.vatAmount,
      totalAmount: note.totalAmount,
      items: note.items,
      qrCode: note.qrCode,
    };
    const { buffer } = await this.pdfService.generateInvoicePdf({
      invoice: fakeInvoice,
      company,
      customer,
      titleEn: 'Credit Note',
      titleAr: 'إشعار دائن',
    });
    await this.pdfService.writePdfToPath(buffer, pdfPath);
    note.pdfPath = pdfPath;

    await this.creditNoteRepository.update(id, {
      status: CreditNoteStatus.ISSUED,
      immutableFlag: true,
      previousHash: note.previousHash,
      currentHash: note.currentHash,
      qrCode: note.qrCode,
      qrCodeData: note.qrCodeData,
      xmlContent: note.xmlContent,
      xmlPath: note.xmlPath,
      pdfPath: note.pdfPath,
    });

    await this.auditLogsService.create({
      entityType: 'credit_note',
      entityId: id,
      action: AuditAction.ISSUE,
      description: `Credit note ${note.noteNumber} issued`,
      metadata: { noteNumber: note.noteNumber, totalAmount: note.totalAmount, hash: currentHash },
    });

    return this.findOne(id);
  }

  async getCreditNotePdfForDownload(
    id: string,
  ): Promise<{ absolutePath: string; filename: string }> {
    const note = await this.findOne(id);
    if (note.status !== CreditNoteStatus.ISSUED) {
      throw new BadRequestException('PDF is available only for issued credit notes');
    }
    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const allowedDir = path.resolve(storagePath, 'pdf');
    const expectedPath = path.resolve(
      allowedDir,
      `${note.companyId}-${note.noteNumber}.pdf`,
    );
    const resolvedPath = note.pdfPath ? path.resolve(note.pdfPath) : expectedPath;
    if (!resolvedPath.startsWith(allowedDir + path.sep)) {
      throw new BadRequestException('Invalid PDF path');
    }

    // Regenerate if missing (supports older records)
    if (!note.pdfPath || !fs.existsSync(resolvedPath)) {
      const dir = path.dirname(expectedPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fakeInvoice: any = {
        invoiceNumber: note.noteNumber,
        issueDateTime: note.issueDateTime,
        subtotal: note.subtotal,
        vatAmount: note.vatAmount,
        totalAmount: note.totalAmount,
        items: note.items,
        qrCode: note.qrCode,
      };
      const { buffer } = await this.pdfService.generateInvoicePdf({
        invoice: fakeInvoice,
        company: note.company,
        customer: note.customer,
        titleEn: 'Credit Note',
        titleAr: 'إشعار دائن',
      });
      await this.pdfService.writePdfToPath(buffer, expectedPath);
      await this.creditNoteRepository.update(id, { pdfPath: expectedPath });
      if (!fs.existsSync(expectedPath)) {
        throw new NotFoundException('PDF file not found on disk');
      }
      return { absolutePath: expectedPath, filename: `${note.noteNumber}.pdf` };
    }

    return { absolutePath: resolvedPath, filename: `${note.noteNumber}.pdf` };
  }
}
