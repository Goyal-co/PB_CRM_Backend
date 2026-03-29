import { PartialType } from '@nestjs/swagger';
import { CreateAgreementTemplateDto } from './create-agreement-template.dto';

export class UpdateAgreementTemplateDto extends PartialType(
  CreateAgreementTemplateDto,
) {}
