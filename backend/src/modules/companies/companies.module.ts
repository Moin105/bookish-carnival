import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { Company } from '../../entities/company.entity';
import { Invoice } from '../../entities/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Invoice])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
