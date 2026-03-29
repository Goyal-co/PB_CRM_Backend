import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateManagerProjectDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  manager_id: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  project_id: string;
}
