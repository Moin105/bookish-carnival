import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { Invoice } from '../../entities/invoice.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Customer, Invoice])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
