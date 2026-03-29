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
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { FormTemplatesService } from './form-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { PatchTemplateDto } from './dto/patch-template.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { PatchSectionDto } from './dto/patch-section.dto';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { ReorderFieldsDto } from './dto/reorder-fields.dto';
import { ToggleFieldDto } from './dto/toggle-field.dto';
import { QueryFormTemplatesDto } from './dto/query-form-templates.dto';
import { QueryFieldsDto } from './dto/query-fields.dto';

@ApiTags('form-templates')
@ApiBearerAuth()
@Controller('form-templates')
export class FormTemplatesController {
  constructor(private readonly service: FormTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List form templates' })
  @ApiResponse({ status: 200 })
  async list(@Query() q: QueryFormTemplatesDto): Promise<unknown> {
    return this.service.listTemplates(q);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create template' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateTemplateDto): Promise<unknown> {
    return this.service.createTemplate(dto);
  }

  @Get(':id/sections')
  @ApiOperation({ summary: 'List sections for template' })
  @ApiResponse({ status: 200 })
  async sections(@Param('id') id: string): Promise<unknown> {
    const rows = await this.service.listSections(id);
    return { data: rows, meta: { total: rows.length } };
  }

  @Post(':id/sections')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create section' })
  @ApiResponse({ status: 201 })
  async addSection(
    @Param('id') id: string,
    @Body() dto: CreateSectionDto,
  ): Promise<unknown> {
    return this.service.createSection(id, dto);
  }

  @Patch(':id/sections/:sectionId')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update section' })
  @ApiResponse({ status: 200 })
  async patchSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: PatchSectionDto,
  ): Promise<unknown> {
    return this.service.patchSection(id, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete section and fields' })
  @ApiResponse({ status: 200 })
  async removeSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
  ): Promise<{ success: boolean }> {
    await this.service.deleteSection(id, sectionId);
    return { success: true };
  }

  @Get(':id/fields')
  @ApiOperation({ summary: 'List fields' })
  @ApiResponse({ status: 200 })
  async fields(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryFieldsDto,
  ): Promise<unknown> {
    return this.service.listFields(id, user, q);
  }

  @Post(':id/fields')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create field (RPC + fallback insert)' })
  @ApiResponse({ status: 201 })
  async addField(
    @Param('id') id: string,
    @Body() dto: CreateFieldDto,
  ): Promise<unknown> {
    return this.service.createField(id, dto);
  }

  @Patch(':id/fields/reorder')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reorder fields' })
  @ApiResponse({ status: 200 })
  async reorder(
    @Param('id') id: string,
    @Body() dto: ReorderFieldsDto,
  ): Promise<unknown> {
    return this.service.reorderFields(id, dto);
  }

  @Patch(':id/fields/:fieldId/toggle')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Toggle field flags' })
  @ApiResponse({ status: 200 })
  async toggle(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: ToggleFieldDto,
  ): Promise<unknown> {
    return this.service.toggleField(id, fieldId, dto);
  }

  @Patch(':id/fields/:fieldId')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update field' })
  @ApiResponse({ status: 200 })
  async patchField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDto,
  ): Promise<unknown> {
    return this.service.updateField(id, fieldId, dto);
  }

  @Delete(':id/fields/:fieldId')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete custom field' })
  @ApiResponse({ status: 200 })
  async removeField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
  ): Promise<{ success: boolean }> {
    await this.service.deleteField(id, fieldId);
    return { success: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Template with nested sections/fields' })
  @ApiResponse({ status: 200 })
  async one(@Param('id') id: string): Promise<unknown> {
    return this.service.getTemplateDetail(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Patch template metadata' })
  @ApiResponse({ status: 200 })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchTemplateDto,
  ): Promise<unknown> {
    return this.service.patchTemplate(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete unused template' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string): Promise<unknown> {
    return this.service.deleteTemplate(id);
  }
}
