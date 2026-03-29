import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentMethod } from '@common/types/supabase.types';

export class RecordPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  amount_paid: number;

  @ApiProperty({
    enum: [
      'cheque',
      'demand_draft',
      'wire_transfer',
      'upi',
      'neft',
      'rtgs',
    ],
  })
  @IsEnum([
    'cheque',
    'demand_draft',
    'wire_transfer',
    'upi',
    'neft',
    'rtgs',
  ] as const)
  payment_method: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cheque_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upi_txn_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  drawn_on?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paid_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tds_deducted?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tds_form_16b?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
