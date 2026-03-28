import { IsString, IsOptional, IsEmail, IsBoolean, Matches } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'vatNumber must be exactly 15 digits (Saudi VAT format)',
  })
  vatNumber: string;

  @IsString()
  @IsOptional()
  commercialRegistration?: string;

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

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
