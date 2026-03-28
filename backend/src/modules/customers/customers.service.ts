import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Invoice } from '../../entities/invoice.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customerRepository.create(createCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async findAll(): Promise<Customer[]> {
    return await this.customerRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, updateCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    const customerSnapshot = {
      id: customer.id,
      name: customer.name,
      vatNumber: customer.vatNumber ?? null,
      address: customer.address ?? null,
      streetName: customer.streetName ?? null,
      buildingNumber: customer.buildingNumber ?? null,
      plotIdentification: customer.plotIdentification ?? null,
      citySubdivisionName: customer.citySubdivisionName ?? null,
      city: customer.city ?? null,
      postalCode: customer.postalCode ?? null,
      country: customer.country ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      type: customer.type ?? null,
      isActive: customer.isActive,
    };

    try {
      // Preserve historical invoice customer data before customer deletion.
      await this.invoiceRepository
        .createQueryBuilder()
        .update(Invoice)
        .set({ customerSnapshot: customerSnapshot as any })
        .where('"customerId" = :customerId', { customerId: id })
        .andWhere('"customerSnapshot" IS NULL')
        .execute();

      await this.customerRepository.delete(id);
    } catch (error: any) {
      if (error instanceof QueryFailedError && error?.driverError?.code === '23503') {
        throw new ConflictException(
          'Cannot delete customer because it is linked to existing records',
        );
      }
      throw error;
    }
  }
}
