import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * When using SQLite (desktop / zero-setup), create a default admin if the DB is empty.
 * Postgres deployments use migrations + manual seed instead.
 */
@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  private usePostgres(): boolean {
    const t = this.config.get<string>('DB_TYPE')?.toLowerCase();
    if (t === 'postgres') return true;
    if (t === 'sqlite') return false;
    const url = this.config.get<string>('DATABASE_URL');
    if (url && /^postgres/i.test(url.trim())) return true;
    const host = this.config.get<string>('DB_HOST');
    return !!host && host.trim().length > 0;
  }

  async onModuleInit(): Promise<void> {
    if (this.usePostgres()) return;
    if (this.config.get<string>('AUTO_SEED_ADMIN', 'true') === 'false') return;

    const count = await this.users.count();
    if (count > 0) return;

    const password = this.config.get<string>('INITIAL_ADMIN_PASSWORD', 'admin123');
    await this.users.save(
      this.users.create({
        email: 'admin@zatca.com',
        password,
        name: 'System Administrator',
        role: 'admin',
        isActive: true,
      }),
    );

    this.logger.log(
      'Created default admin (SQLite) — email: admin@zatca.com — change password after login.',
    );
  }
}
