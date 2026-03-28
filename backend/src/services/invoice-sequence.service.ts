import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InvoiceSequence } from '../entities/invoice-sequence.entity';
import { Invoice } from '../entities/invoice.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { DebitNote } from '../entities/debit-note.entity';

function maxNumericSuffixFromStrings(values: Array<string | null | undefined>): number {
  let max = 0;
  for (const v of values) {
    const digits = String(v ?? '').replace(/\D/g, '');
    const n = parseInt(digits || '0', 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

function applySequenceLock(
  qb: SelectQueryBuilder<InvoiceSequence>,
  em: EntityManager,
): SelectQueryBuilder<InvoiceSequence> {
  const t = em.connection.driver.options.type;
  if (t === 'sqljs') {
    return qb;
  }
  return qb.setLock('pessimistic_write');
}

@Injectable()
export class InvoiceSequenceService {
  constructor(
    @InjectRepository(InvoiceSequence)
    private sequenceRepository: Repository<InvoiceSequence>,
    private dataSource: DataSource,
  ) {}

  private async maxInvoiceNumericSuffix(
    em: EntityManager,
    companyId: string,
  ): Promise<number> {
    const rows = await em
      .getRepository(Invoice)
      .createQueryBuilder('i')
      .select('i.invoiceNumber', 'invoiceNumber')
      .where('i.companyId = :companyId', { companyId })
      .getRawMany<{ invoiceNumber: string }>();
    return maxNumericSuffixFromStrings(rows.map((r) => r.invoiceNumber));
  }

  private async maxCreditNoteNumericSuffix(
    em: EntityManager,
    companyId: string,
  ): Promise<number> {
    const rows = await em
      .getRepository(CreditNote)
      .createQueryBuilder('n')
      .select('n.noteNumber', 'noteNumber')
      .where('n.companyId = :companyId', { companyId })
      .getRawMany<{ noteNumber: string }>();
    return maxNumericSuffixFromStrings(rows.map((r) => r.noteNumber));
  }

  private async maxDebitNoteNumericSuffix(
    em: EntityManager,
    companyId: string,
  ): Promise<number> {
    const rows = await em
      .getRepository(DebitNote)
      .createQueryBuilder('n')
      .select('n.noteNumber', 'noteNumber')
      .where('n.companyId = :companyId', { companyId })
      .getRawMany<{ noteNumber: string }>();
    return maxNumericSuffixFromStrings(rows.map((r) => r.noteNumber));
  }

  /**
   * Get next invoice number for company (e.g. INV-1, INV-2). Thread-safe via transaction.
   */
  async getNextInvoiceNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      let seq = await applySequenceLock(
        em.getRepository(InvoiceSequence).createQueryBuilder('s').where('s.companyId = :companyId', {
          companyId,
        }),
        em,
      ).getOne();

      const maxExistingInvoiceNumber = await this.maxInvoiceNumericSuffix(em, companyId);

      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: maxExistingInvoiceNumber,
          lastCreditNoteNumber: 0,
          lastDebitNoteNumber: 0,
        });
        await em.save(seq);
      } else if ((seq.lastInvoiceNumber || 0) < maxExistingInvoiceNumber) {
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
      let seq = await applySequenceLock(
        em.getRepository(InvoiceSequence).createQueryBuilder('s').where('s.companyId = :companyId', {
          companyId,
        }),
        em,
      ).getOne();

      const maxExistingCreditNoteNumber = await this.maxCreditNoteNumericSuffix(em, companyId);

      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
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
      let seq = await applySequenceLock(
        em.getRepository(InvoiceSequence).createQueryBuilder('s').where('s.companyId = :companyId', {
          companyId,
        }),
        em,
      ).getOne();

      const maxExistingDebitNoteNumber = await this.maxDebitNoteNumericSuffix(em, companyId);

      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
          lastCreditNoteNumber: 0,
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
