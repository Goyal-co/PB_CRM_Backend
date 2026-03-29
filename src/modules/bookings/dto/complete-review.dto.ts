import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CompleteReviewDto {
  @ApiProperty({ enum: ['approve', 'reject', 'request_revision'] })
  @IsIn(['approve', 'reject', 'request_revision'])
  action: 'approve' | 'reject' | 'request_revision';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
