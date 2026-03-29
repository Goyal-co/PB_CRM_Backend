import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { FieldDataType } from '@common/types/supabase.types';

export class CreateFieldDto {
  @ApiProperty()
  @IsUUID()
  section_id: string;

  @ApiProperty({ description: 'snake_case key' })
  @Matches(/^[a-z][a-z0-9_]+$/)
  @IsString()
  @IsNotEmpty()
  field_key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  field_label: string;

  @ApiProperty({ enum: [
    'text', 'textarea', 'number', 'decimal', 'date', 'boolean', 'select',
    'multiselect', 'phone', 'email', 'file',
  ]})
  @IsEnum([
    'text', 'textarea', 'number', 'decimal', 'date', 'boolean', 'select',
    'multiselect', 'phone', 'email', 'file',
  ] as const)
  data_type: FieldDataType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visible_to_user?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  editable_by_user?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visible_to_manager?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  editable_by_manager?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  display_order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  help_text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validation_regex?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  default_value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  max_file_size_mb?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  accepted_file_types?: string[];
}
