import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RevokeUserBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
