import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Supabase refresh_token from login or refresh' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
