import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ISSUE = 'issue',
  VIEW = 'view',
  EXPORT = 'export',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entityType: string; // 'invoice', 'customer', 'company', etc.

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'varchar', length: 32 })
  action: AuditAction;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
