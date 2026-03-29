import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import {
  TowerName,
  UnitStatus,
  UnitType,
} from '@common/types/supabase.types';

export class QueryUnitsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

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
  @IsEnum([
    'available',
    'blocked',
    'booked',
    'agreement_signed',
    'registered',
    'cancelled',
  ] as const)
  status?: UnitStatus;
}
