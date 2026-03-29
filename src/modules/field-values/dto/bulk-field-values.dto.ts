import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class BulkFieldValueItem {
  @ApiProperty()
  @IsUUID()
  field_id: string;

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

export class BulkFieldValuesDto {
  @ApiProperty({ type: [BulkFieldValueItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkFieldValueItem)
  values: BulkFieldValueItem[];
}
