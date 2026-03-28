import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../../entities/audit-log.entity';

export interface CreateAuditLogDto {
  entityType: string;
  entityId?: string;
  action: AuditAction;
  description?: string;
  metadata?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(createAuditLogDto);
    return await this.auditLogRepository.save(auditLog);
  }

  async findAll(): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
