import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class FieldOrderItem {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  display_order: number;
}

export class ReorderFieldsDto {
  @ApiProperty({ type: [FieldOrderItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FieldOrderItem)
  fields: FieldOrderItem[];
}
