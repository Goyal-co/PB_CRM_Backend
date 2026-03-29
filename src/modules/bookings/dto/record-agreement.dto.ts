import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class RecordAgreementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storage_path: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @ApiProperty()
  @IsNumber()
  size_bytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preview_url?: string;
}
