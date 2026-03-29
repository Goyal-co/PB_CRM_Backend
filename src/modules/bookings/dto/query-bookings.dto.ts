import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import {
  BookingStatus,
  TowerName,
  UnitType,
} from '@common/types/supabase.types';

export class QueryBookingsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigned_manager_id?: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D', 'E'] })
  @IsOptional()
  @IsEnum(['A', 'B', 'C', 'D', 'E'] as const)
  tower?: TowerName;

  @ApiPropertyOptional({ enum: ['2bhk', '2_5bhk', '3bhk'] })
  @IsOptional()
  @IsEnum(['2bhk', '2_5bhk', '3bhk'] as const)
  unit_type?: UnitType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
