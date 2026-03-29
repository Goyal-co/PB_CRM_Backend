import { Module } from '@nestjs/common';
import { FormTemplatesController } from './form-templates.controller';
import { FormTemplatesService } from './form-templates.service';

@Module({
  controllers: [FormTemplatesController],
  providers: [FormTemplatesService],
  exports: [FormTemplatesService],
})
export class FormTemplatesModule {}
