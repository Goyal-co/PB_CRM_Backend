import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { UserRole } from '@common/types/user.types';

export class QueryProfilesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['super_admin', 'manager', 'user'] })
  @IsOptional()
  @IsIn(['super_admin', 'manager', 'user'])
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
