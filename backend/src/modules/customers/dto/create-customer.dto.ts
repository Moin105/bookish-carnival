import { IsString, IsOptional, IsEmail, IsBoolean, IsEnum } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  vatNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  streetName?: string;

  @IsString()
  @IsOptional()
  buildingNumber?: string;

  @IsString()
  @IsOptional()
  plotIdentification?: string;

  @IsString()
  @IsOptional()
  citySubdivisionName?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(['B2B', 'B2C'])
  @IsOptional()
  type?: 'B2B' | 'B2C';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
