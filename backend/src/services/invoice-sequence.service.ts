import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InvoiceSequence } from '../entities/invoice-sequence.entity';
import { Invoice } from '../entities/invoice.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { DebitNote } from '../entities/debit-note.entity';

@Injectable()
export class InvoiceSequenceService {
  constructor(
    @InjectRepository(InvoiceSequence)
    private sequenceRepository: Repository<InvoiceSequence>,
    private dataSource: DataSource,
  ) {}

  /**
   * Get next invoice number for company (e.g. INV-1, INV-2). Thread-safe via transaction.
   */
  async getNextInvoiceNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      // Lock the sequence row (if it exists) to prevent concurrent increments.
      let seq = await em
        .getRepository(InvoiceSequence)
        .createQueryBuilder('s')
        .where('s.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();

      const maxExistingInvoiceNumberRow = await em
        .getRepository(Invoice)
        .createQueryBuilder('i')
        .select(
          `COALESCE(MAX(NULLIF(regexp_replace(i.invoiceNumber, '[^0-9]', '', 'g'), '')::int), 0)`,
          'max',
        )
        .where('i.companyId = :companyId', { companyId })
        .getRawOne();

      const maxExistingInvoiceNumber = Number((maxExistingInvoiceNumberRow as any)?.max ?? 0);

      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          // Initialize from existing invoices so we don't reuse INV-* after a reset.
          lastInvoiceNumber: maxExistingInvoiceNumber,
          lastCreditNoteNumber: 0,
          lastDebitNoteNumber: 0,
        });
        await em.save(seq);
      } else if ((seq.lastInvoiceNumber || 0) < maxExistingInvoiceNumber) {
        // If the stored sequence is behind what exists in the invoices table, bump it.
        seq.lastInvoiceNumber = maxExistingInvoiceNumber;
      }

      seq.lastInvoiceNumber = (seq.lastInvoiceNumber || 0) + 1;
      await em.save(seq);
      return `INV-${seq.lastInvoiceNumber}`;
    });
  }

  /**
   * Get next credit note number for company (e.g. CN-1, CN-2).
   */
  async getNextCreditNoteNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      // Lock the sequence row (if it exists) to prevent concurrent increments.
      let seq = await em
        .getRepository(InvoiceSequence)
        .createQueryBuilder('s')
        .where('s.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();

      const maxExistingCreditNoteNumberRow = await em
        .getRepository(CreditNote)
        .createQueryBuilder('n')
        .select(
          `COALESCE(MAX(NULLIF(regexp_replace(n.noteNumber, '[^0-9]', '', 'g'), '')::int), 0)`,
          'max',
        )
        .where('n.companyId = :companyId', { companyId })
        .getRawOne();

      const maxExistingCreditNoteNumber = Number(
        (maxExistingCreditNoteNumberRow as any)?.max ?? 0,
      );

      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
          // Initialize from existing credit notes so we don't reuse CN-* after a reset.
          lastCreditNoteNumber: maxExistingCreditNoteNumber,
          lastDebitNoteNumber: 0,
        });
        await em.save(seq);
      } else if ((seq.lastCreditNoteNumber || 0) < maxExistingCreditNoteNumber) {
        seq.lastCreditNoteNumber = maxExistingCreditNoteNumber;
      }

      seq.lastCreditNoteNumber = (seq.lastCreditNoteNumber || 0) + 1;
      await em.save(seq);
      return `CN-${seq.lastCreditNoteNumber}`;
    });
  }

  /**
   * Get next debit note number for company (e.g. DN-1, DN-2).
   */
  async getNextDebitNoteNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      // Lock the sequence row (if it exists) to prevent concurrent increments.
      let seq = await em
        .getRepository(InvoiceSequence)
        .createQueryBuilder('s')
        .where('s.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();

      const maxExistingDebitNoteNumberRow = await em
        .getRepository(DebitNote)
        .createQueryBuilder('n')
        .select(
          `COALESCE(MAX(NULLIF(regexp_replace(n.noteNumber, '[^0-9]', '', 'g'), '')::int), 0)`,
          'max',
        )
        .where('n.companyId = :companyId', { companyId })
        .getRawOne();

      const maxExistingDebitNoteNumber = Number((maxExistingDebitNoteNumberRow as any)?.max ?? 0);

      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
          lastCreditNoteNumber: 0,
          // Initialize from existing debit notes so we don't reuse DN-* after a reset.
          lastDebitNoteNumber: maxExistingDebitNoteNumber,
        });
        await em.save(seq);
      } else if ((seq.lastDebitNoteNumber || 0) < maxExistingDebitNoteNumber) {
        seq.lastDebitNoteNumber = maxExistingDebitNoteNumber;
      }

      seq.lastDebitNoteNumber = (seq.lastDebitNoteNumber || 0) + 1;
      await em.save(seq);
      return `DN-${seq.lastDebitNoteNumber}`;
    });
  }
}
