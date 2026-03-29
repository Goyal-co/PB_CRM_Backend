import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { DocType } from '@common/types/supabase.types';

const DOC_TYPES: DocType[] = [
  'aadhar_card',
  'pan_card',
  'passport',
  'voter_id',
  'driving_license',
  'oci_pio_card',
  'business_card',
  'passport_photo',
  'agreement_for_sale',
  'payment_receipt',
  'floor_plan',
  'other',
];

export class QueryDocumentsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  booking_id?: string;

  @ApiPropertyOptional({ enum: DOC_TYPES })
  @IsOptional()
  @IsIn(DOC_TYPES)
  type?: DocType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_verified?: boolean;
}
