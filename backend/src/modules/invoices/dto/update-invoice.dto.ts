import { IsOptional, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceItemDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @IsDateString()
  @IsOptional()
  issueDateTime?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  @IsOptional()
  items?: CreateInvoiceItemDto[];
}
