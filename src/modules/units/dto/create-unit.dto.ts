import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TowerName, UnitType } from '@common/types/supabase.types';

export class CreateUnitDto {
  @ApiProperty()
  @IsUUID()
  project_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit_no: string;

  @ApiProperty({ enum: ['A', 'B', 'C', 'D', 'E'] })
  @IsEnum(['A', 'B', 'C', 'D', 'E'] as const)
  tower: TowerName;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  floor_no: number;

  @ApiProperty({ enum: ['2bhk', '2_5bhk', '3bhk'] })
  @IsEnum(['2bhk', '2_5bhk', '3bhk'] as const)
  unit_type: UnitType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  carpet_area_sqft: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  super_built_up_sqft: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  balcony_area_sqft?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  no_of_parking?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facing?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  basic_rate_per_sqft: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  basic_sale_value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gst_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maintenance_24mo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  corpus_fund?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  other_charges?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gross_apartment_value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  undivided_share_sqft?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  undivided_share_fraction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floor_plan_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
