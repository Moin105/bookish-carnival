import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';

/**
 * Per-company sequential numbering for ZATCA-compliant document numbers.
 * INV: tax invoices, CN: credit notes, DN: debit notes.
 */
@Entity('invoice_sequences')
export class InvoiceSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  companyId: string;

  @OneToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'int', default: 0 })
  lastInvoiceNumber: number;

  @Column({ type: 'int', default: 0 })
  lastCreditNoteNumber: number;

  @Column({ type: 'int', default: 0 })
  lastDebitNoteNumber: number;
}
