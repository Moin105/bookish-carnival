import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DebitNote } from './debit-note.entity';

@Entity('debit_note_items')
export class DebitNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  debitNoteId: string;

  @ManyToOne(() => DebitNote, (note) => note.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debitNoteId' })
  debitNote: DebitNote;

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
