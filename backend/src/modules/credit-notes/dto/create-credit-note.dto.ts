import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCreditNoteItemDto {
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
  vatRate?: number;
}

export class CreateCreditNoteDto {
  @IsUUID()
  originalInvoiceId: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteItemDto)
  items: CreateCreditNoteItemDto[];
}
