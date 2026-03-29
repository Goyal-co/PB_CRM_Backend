import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  father_husband_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marital_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadhar_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pan_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alternate_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  communication_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  permanent_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employer_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  place_of_business?: string;

  /** Ignored by API; DB policies prevent self-promotion. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['super_admin', 'manager', 'user'])
  role?: 'super_admin' | 'manager' | 'user';
}
