import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReviewItemStatus } from '@common/types/supabase.types';

export class ReviewFieldDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  field_id: string;

  @ApiProperty({
    enum: ['not_reviewed', 'ok', 'needs_revision'],
  })
  @IsEnum(['not_reviewed', 'ok', 'needs_revision'] as const)
  status: ReviewItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
