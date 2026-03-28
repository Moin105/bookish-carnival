import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { Invoice } from '../../entities/invoice.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {}

  async summary(): Promise<{
    companyCount: number;
    customerCount: number;
    invoiceCount: number;
  }> {
    const [companyCount, customerCount, invoiceCount] = await Promise.all([
      // Count all companies present in DB.
      this.companyRepository.count(),
      this.customerRepository.count({ where: { isActive: true } }),
      this.invoiceRepository.count(),
    ]);
    return { companyCount, customerCount, invoiceCount };
  }
}
