import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class PossessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  oc_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  possession_offered_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  possession_taken_at?: string;
}
