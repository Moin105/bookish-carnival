import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CreditNote } from './credit-note.entity';

@Entity('credit_note_items')
export class CreditNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  creditNoteId: string;

  @ManyToOne(() => CreditNote, (note) => note.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditNoteId' })
  creditNote: CreditNote;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  vatRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: number;

  @CreateDateColumn()
  createdAt: Date;
}
