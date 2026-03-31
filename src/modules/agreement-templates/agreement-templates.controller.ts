import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { AgreementTemplatesService } from './agreement-templates.service';
import { CreateAgreementTemplateDto } from './dto/create-agreement-template.dto';
import { UpdateAgreementTemplateDto } from './dto/update-agreement-template.dto';
import { QueryAgreementTemplatesDto } from './dto/query-agreement-templates.dto';

@ApiTags('agreement-templates')
@ApiBearerAuth()
@Controller('agreement-templates')
export class AgreementTemplatesController {
  constructor(private readonly service: AgreementTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List agreement templates (no body_html)' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryAgreementTemplatesDto,
  ): Promise<unknown> {
    return this.service.listForUser(user, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full agreement template' })
  @ApiResponse({ status: 200 })
  async one(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.findOneForUser(user, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create agreement template' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateAgreementTemplateDto): Promise<unknown> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update template (version++)' })
  @ApiResponse({ status: 200 })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgreementTemplateDto,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete unused agreement template' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string): Promise<unknown> {
    return this.service.remove(id);
  }
}
