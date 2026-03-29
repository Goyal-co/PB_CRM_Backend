import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber } from 'class-validator';

export class InterestDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  interest_rate: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  interest_amount: number;

  @ApiProperty()
  @IsDateString()
  interest_from_date: string;
}
