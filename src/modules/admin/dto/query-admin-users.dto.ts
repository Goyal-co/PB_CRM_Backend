import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

const ADMIN_LIST_ROLES = ['super_admin', 'manager', 'user'] as const;

export class QueryAdminUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ADMIN_LIST_ROLES })
  @IsOptional()
  @IsEnum(ADMIN_LIST_ROLES)
  role?: (typeof ADMIN_LIST_ROLES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

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
