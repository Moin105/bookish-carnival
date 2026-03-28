import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  BeforeRemove,
} from 'typeorm';
import { Invoice, InvoiceStatus } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  vatRate: number; // VAT rate in percentage (default 15% for Saudi Arabia)

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: number;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Entity hooks to prevent modification of invoice items
   * when the parent invoice is immutable/issued
   * Note: The actual check is done via database triggers for reliability
   * This hook provides an additional application-level check
   */
  @BeforeInsert()
  @BeforeUpdate()
  @BeforeRemove()
  async preventModificationIfInvoiceImmutable() {
    // If invoice relation is loaded, check it directly
    if (this.invoice) {
      const invoice = this.invoice as Invoice;
      if (invoice.immutableFlag || invoice.status === InvoiceStatus.ISSUED) {
        throw new Error(
          'Cannot modify items of an issued invoice. The invoice has been finalized and cannot be changed.',
        );
      }
    }
    // If invoice is not loaded, database trigger will handle the protection
  }
}
