import {
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  vatRate?: number; // Default 15% for Saudi Arabia
}

export class CreateInvoiceDto {
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsDateString()
  @IsOptional()
  issueDateTime?: string;

  @IsUUID()
  companyId: string;

  @IsUUID()
  customerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
