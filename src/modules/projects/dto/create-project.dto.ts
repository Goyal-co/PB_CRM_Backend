import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rera_number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rera_website: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  plan_sanction_no: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  land_area_guntas: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  total_units?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  total_towers?: number;

  @ApiProperty()
  @IsDateString()
  possession_date: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor_pan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor_rep_name?: string;
}
