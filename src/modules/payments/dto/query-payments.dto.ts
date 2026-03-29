import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import {
  PaymentMilestone,
  PaymentStatus,
} from '@common/types/supabase.types';

const MILESTONES: PaymentMilestone[] = [
  'booking_5pct',
  'agreement_5pct',
  'excavation_10pct',
  'foundation_10pct',
  'slab_floor_1_5pct',
  'slab_floor_4_5pct',
  'slab_floor_6_5pct',
  'slab_floor_8_5pct',
  'slab_floor_10_5pct',
  'slab_floor_12_10pct',
  'slab_floor_14_5pct',
  'slab_floor_16_5pct',
  'slab_floor_18_5pct',
  'slab_floor_20_5pct',
  'slab_floor_22_5pct',
  'slab_floor_24_5pct',
  'possession_registration_5pct',
];

const STATUSES: PaymentStatus[] = [
  'pending',
  'demanded',
  'received',
  'cleared',
  'bounced',
  'refunded',
];

export class QueryPaymentsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  booking_id?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ enum: MILESTONES })
  @IsOptional()
  @IsIn(MILESTONES)
  milestone?: PaymentMilestone;
}

export class CollectionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month?: number;
}
