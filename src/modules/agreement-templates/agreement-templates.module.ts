import { Module } from '@nestjs/common';
import { AgreementTemplatesController } from './agreement-templates.controller';
import { AgreementTemplatesService } from './agreement-templates.service';

@Module({
  controllers: [AgreementTemplatesController],
  providers: [AgreementTemplatesService],
  exports: [AgreementTemplatesService],
})
export class AgreementTemplatesModule {}
