import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertFieldValueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value_text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  value_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  value_boolean?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  value_json?: Record<string, unknown>;
}
