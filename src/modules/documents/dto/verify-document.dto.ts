import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class VerifyDocumentDto {
  @ApiProperty()
  @IsBoolean()
  is_verified: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
