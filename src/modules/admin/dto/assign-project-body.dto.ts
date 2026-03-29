import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignProjectBodyDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  project_id: string;
}
