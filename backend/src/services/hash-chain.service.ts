import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { CreditNote, CreditNoteStatus } from '../entities/credit-note.entity';
import { DebitNote, DebitNoteStatus } from '../entities/debit-note.entity';
import * as crypto from 'crypto';

@Injectable()
export class HashChainService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(CreditNote)
    private creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(DebitNote)
    private debitNoteRepository: Repository<DebitNote>,
  ) {}

  generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get the currentHash of the most recently issued document (invoice, credit note, or debit note) for chaining.
   */
  async getPreviousDocumentHash(companyId: string): Promise<string | null> {
    const [lastInv, lastCN, lastDN] = await Promise.all([
      this.invoiceRepository.findOne({
        where: { companyId, status: InvoiceStatus.ISSUED, immutableFlag: true },
        order: { issueDateTime: 'DESC' },
        select: ['currentHash', 'issueDateTime'],
      }),
      this.creditNoteRepository.findOne({
        where: { companyId, status: CreditNoteStatus.ISSUED, immutableFlag: true },
        order: { issueDateTime: 'DESC' },
        select: ['currentHash', 'issueDateTime'],
      }),
      this.debitNoteRepository.findOne({
        where: { companyId, status: DebitNoteStatus.ISSUED, immutableFlag: true },
        order: { issueDateTime: 'DESC' },
        select: ['currentHash', 'issueDateTime'],
      }),
    ]);

    const candidates: { hash: string | null; date: Date }[] = [
      { hash: lastInv?.currentHash ?? null, date: lastInv?.issueDateTime ?? new Date(0) },
      { hash: lastCN?.currentHash ?? null, date: lastCN?.issueDateTime ?? new Date(0) },
      { hash: lastDN?.currentHash ?? null, date: lastDN?.issueDateTime ?? new Date(0) },
    ].filter((c) => c.hash);

    if (candidates.length === 0) return null;
    const latest = candidates.reduce((a, b) => (a.date > b.date ? a : b));
    return latest.hash;
  }

  /** @deprecated Use getPreviousDocumentHash for new code. */
  async getPreviousInvoiceHash(companyId: string): Promise<string | null> {
    return this.getPreviousDocumentHash(companyId);
  }

  generateInvoiceHash(invoice: Invoice, previousHash: string | null): string {
    const data = JSON.stringify({
      type: 'invoice',
      invoiceNumber: invoice.invoiceNumber,
      issueDateTime: invoice.issueDateTime.toISOString(),
      companyId: invoice.companyId,
      customerId: invoice.customerId,
      subtotal: invoice.subtotal,
      vatAmount: invoice.vatAmount,
      totalAmount: invoice.totalAmount,
      previousHash: previousHash || '',
    });
    return this.generateHash(previousHash ? `${previousHash}${data}` : data);
  }

  generateCreditNoteHash(note: CreditNote, previousHash: string | null): string {
    const data = JSON.stringify({
      type: 'credit_note',
      noteNumber: note.noteNumber,
      issueDateTime: note.issueDateTime.toISOString(),
      companyId: note.companyId,
      customerId: note.customerId,
      originalInvoiceId: note.originalInvoiceId,
      subtotal: note.subtotal,
      vatAmount: note.vatAmount,
      totalAmount: note.totalAmount,
      previousHash: previousHash || '',
    });
    return this.generateHash(previousHash ? `${previousHash}${data}` : data);
  }

  generateDebitNoteHash(note: DebitNote, previousHash: string | null): string {
    const data = JSON.stringify({
      type: 'debit_note',
      noteNumber: note.noteNumber,
      issueDateTime: note.issueDateTime.toISOString(),
      companyId: note.companyId,
      customerId: note.customerId,
      originalInvoiceId: note.originalInvoiceId,
      subtotal: note.subtotal,
      vatAmount: note.vatAmount,
      totalAmount: note.totalAmount,
      previousHash: previousHash || '',
    });
    return this.generateHash(previousHash ? `${previousHash}${data}` : data);
  }

  async validateHashChain(companyId: string): Promise<boolean> {
    const invoices = await this.invoiceRepository.find({
      where: { companyId, status: InvoiceStatus.ISSUED, immutableFlag: true },
      order: { issueDateTime: 'ASC' },
    });
    const creditNotes = await this.creditNoteRepository.find({
      where: { companyId, status: CreditNoteStatus.ISSUED, immutableFlag: true },
      order: { issueDateTime: 'ASC' },
    });
    const debitNotes = await this.debitNoteRepository.find({
      where: { companyId, status: DebitNoteStatus.ISSUED, immutableFlag: true },
      order: { issueDateTime: 'ASC' },
    });

    const all: Array<{ issueDateTime: Date; currentHash: string; expectedHash: (prev: string | null) => string }> = [];

    for (const inv of invoices) {
      all.push({
        issueDateTime: inv.issueDateTime,
        currentHash: inv.currentHash!,
        expectedHash: (prev) => this.generateInvoiceHash(inv, prev),
      });
    }
    for (const cn of creditNotes) {
      all.push({
        issueDateTime: cn.issueDateTime,
        currentHash: cn.currentHash!,
        expectedHash: (prev) => this.generateCreditNoteHash(cn, prev),
      });
    }
    for (const dn of debitNotes) {
      all.push({
        issueDateTime: dn.issueDateTime,
        currentHash: dn.currentHash!,
        expectedHash: (prev) => this.generateDebitNoteHash(dn, prev),
      });
    }

    all.sort((a, b) => new Date(a.issueDateTime).getTime() - new Date(b.issueDateTime).getTime());

    let previousHash: string | null = null;
    for (const doc of all) {
      const expected = doc.expectedHash(previousHash);
      if (expected !== doc.currentHash) return false;
      previousHash = doc.currentHash;
    }
    return true;
  }
}
