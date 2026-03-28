import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeUpdate,
} from 'typeorm';
import { Company } from './company.entity';
import { Customer } from './customer.entity';
import { Invoice } from './invoice.entity';
import { CreditNoteItem } from './credit-note-item.entity';

export enum CreditNoteStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

@Index('UQ_credit_notes_companyId_noteNumber', ['companyId', 'noteNumber'], { unique: true })
@Entity('credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  noteNumber: string;

  @Column({ type: 'timestamp' })
  issueDateTime: Date;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: Company | null;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'uuid' })
  originalInvoiceId: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'originalInvoiceId' })
  originalInvoice: Invoice;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  previousHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentHash: string;

  @Column({ type: 'varchar', length: 20, default: CreditNoteStatus.DRAFT })
  status: CreditNoteStatus;

  @Column({ type: 'boolean', default: false })
  immutableFlag: boolean;

  @BeforeUpdate()
  preventUpdateIfImmutable() {
    if (this.immutableFlag || this.status === CreditNoteStatus.ISSUED) {
      throw new Error('Cannot update an issued/immutable credit note.');
    }
  }

  @Column({ type: 'text', nullable: true })
  qrCode: string;

  @Column({ type: 'text', nullable: true })
  qrCodeData: string;

  @Column({ type: 'text', nullable: true })
  xmlContent: string;

  @Column({ type: 'text', nullable: true })
  pdfPath: string;

  @Column({ type: 'text', nullable: true })
  xmlPath: string;

  @OneToMany(() => CreditNoteItem, (item) => item.creditNote, { cascade: true })
  items: CreditNoteItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
