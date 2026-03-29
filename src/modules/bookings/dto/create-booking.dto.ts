import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { JointAllotteeDto } from './joint-allottee.dto';

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  project_id: string;

  @ApiProperty()
  @IsUUID()
  unit_id: string;

  @ApiProperty()
  @IsUUID()
  form_template_id: string;

  @ApiProperty()
  @IsUUID()
  agreement_template_id: string;

  @ApiPropertyOptional({ type: [JointAllotteeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => JointAllotteeDto)
  joint_allottees?: JointAllotteeDto[];

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
