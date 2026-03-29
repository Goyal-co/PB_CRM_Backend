import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allottee_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allottee_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allottee_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agent_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agent_rera_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agent_represented_by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agent_contact_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agent_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fund_source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  home_loan_pct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
