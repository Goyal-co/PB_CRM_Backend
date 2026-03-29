import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';

export class DemandPaymentDto {
  @ApiProperty()
  @IsDateString()
  due_date: string;

  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  notice_number: 1 | 2;
}
