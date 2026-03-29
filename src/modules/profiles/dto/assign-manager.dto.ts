import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignManagerDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  manager_id: string;
}
