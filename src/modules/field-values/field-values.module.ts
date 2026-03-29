import { Module } from '@nestjs/common';
import { FieldValuesController } from './field-values.controller';
import { FieldValuesService } from './field-values.service';

@Module({
  controllers: [FieldValuesController],
  providers: [FieldValuesService],
})
export class FieldValuesModule {}
