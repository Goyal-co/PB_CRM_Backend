import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { UserRole } from '@common/types/user.types';

export class UpdateRoleDto {
  @ApiProperty({ enum: ['super_admin', 'manager', 'user'] })
  @IsIn(['super_admin', 'manager', 'user'])
  @IsNotEmpty()
  role: UserRole;
}
