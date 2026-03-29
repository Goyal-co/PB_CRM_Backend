import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { ReorderFieldsDto } from './dto/reorder-fields.dto';
import { QueryFormTemplatesDto } from './dto/query-form-templates.dto';
import { QueryFieldsDto } from './dto/query-fields.dto';

@Injectable()
export class FormTemplatesService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Paginated form templates with optional project and active filters.
   */
  async listTemplates(q: QueryFormTemplatesDto): Promise<{
    data: unknown[];
    meta: Record<string, number>;
  }> {
    const admin = this.supabase.supabaseAdmin;
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;
    let qb = admin.from('form_templates').select('*', { count: 'exact' });
    if (q.project_id) {
      qb = qb.eq('project_id', q.project_id);
    }
    if (q.is_active !== undefined) {
      qb = qb.eq('is_active', q.is_active);
    }
    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'FORM_TEMPLATES_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  /**
   * Loads a template plus nested sections and fields for admin/runtime rendering.
   */
  async getTemplateDetail(id: string): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const { data: template, error: tErr } = await admin
      .from('form_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (tErr) {
      throwFromPostgrest(tErr, 'FORM_TEMPLATE_LOAD_FAILED');
    }
    if (!template) {
      throw new NotFoundException({
        message: 'Form template not found',
        error: 'FORM_TEMPLATE_NOT_FOUND',
      });
    }
    const { data: sections, error: sErr } = await admin
      .from('form_sections')
      .select('*')
      .eq('template_id', id)
      .order('display_order', { ascending: true });
    if (sErr) {
      throwFromPostgrest(sErr, 'FORM_SECTIONS_LOAD_FAILED');
    }
    const sectionList = sections ?? [];
    const sectionIds = sectionList.map((s) => (s as { id: string }).id);
    let fields: unknown[] = [];
    if (sectionIds.length) {
      const { data: fieldRows, error: fErr } = await admin
        .from('form_fields')
        .select('*')
        .in('section_id', sectionIds)
        .order('display_order', { ascending: true });
      if (fErr) {
        throwFromPostgrest(fErr, 'FORM_FIELDS_LOAD_FAILED');
      }
      fields = fieldRows ?? [];
    }
    const bySection = new Map<string, unknown[]>();
    for (const f of fields) {
      const sid = (f as { section_id: string }).section_id;
      if (!bySection.has(sid)) {
        bySection.set(sid, []);
      }
      bySection.get(sid)!.push(f);
    }
    const nested = sectionList.map((s) => ({
      ...(s as object),
      fields: bySection.get((s as { id: string }).id) ?? [],
    }));
    return { ...(template as object), sections: nested };
  }

  /**
   * Persists a new template shell for a project.
   */
  async createTemplate(dto: CreateTemplateDto): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('form_templates')
      .insert({
        project_id: dto.project_id,
        name: dto.name,
        description: dto.description ?? null,
        is_active: true,
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'FORM_TEMPLATE_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Updates template metadata without touching nested structure.
   */
  async patchTemplate(
    id: string,
    patch: { name?: string; description?: string; is_active?: boolean },
  ): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('form_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          message: 'Form template not found',
          error: 'FORM_TEMPLATE_NOT_FOUND',
        });
      }
      throwFromPostgrest(error, 'FORM_TEMPLATE_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Hard-deletes a template only when no booking references it.
   */
  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    const { count, error: cErr } = await this.supabase.supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('form_template_id', id);
    if (cErr) {
      throwFromPostgrest(cErr, 'BOOKING_CHECK_FAILED');
    }
    if ((count ?? 0) > 0) {
      throw new BadRequestException({
        message: 'Template is referenced by bookings',
        error: 'TEMPLATE_IN_USE',
      });
    }
    const { error } = await this.supabase.supabaseAdmin
      .from('form_templates')
      .delete()
      .eq('id', id);
    if (error) {
      throwFromPostgrest(error, 'FORM_TEMPLATE_DELETE_FAILED');
    }
    return { success: true };
  }

  async listSections(templateId: string): Promise<unknown[]> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('form_sections')
      .select('*')
      .eq('template_id', templateId)
      .order('display_order', { ascending: true });
    if (error) {
      throwFromPostgrest(error, 'SECTIONS_LIST_FAILED');
    }
    return data ?? [];
  }

  async createSection(
    templateId: string,
    dto: CreateSectionDto,
  ): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('form_sections')
      .insert({
        template_id: templateId,
        section_label: dto.section_label,
        section_key: dto.section_key ?? null,
        display_order: dto.display_order ?? 0,
        is_active: dto.is_active ?? true,
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'SECTION_CREATE_FAILED');
    }
    return data;
  }

  async patchSection(
    templateId: string,
    sectionId: string,
    patch: {
      section_label?: string;
      display_order?: number;
      is_active?: boolean;
    },
  ): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('form_sections')
      .update({ ...patch })
      .eq('id', sectionId)
      .eq('template_id', templateId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          message: 'Section not found',
          error: 'SECTION_NOT_FOUND',
        });
      }
      throwFromPostgrest(error, 'SECTION_UPDATE_FAILED');
    }
    return data;
  }

  async deleteSection(templateId: string, sectionId: string): Promise<void> {
    const { error: fErr } = await this.supabase.supabaseAdmin
      .from('form_fields')
      .delete()
      .eq('section_id', sectionId);
    if (fErr) {
      throwFromPostgrest(fErr, 'FIELD_DELETE_FAILED');
    }
    const { error } = await this.supabase.supabaseAdmin
      .from('form_sections')
      .delete()
      .eq('id', sectionId)
      .eq('template_id', templateId);
    if (error) {
      throwFromPostgrest(error, 'SECTION_DELETE_FAILED');
    }
  }

  /**
   * Lists fields with optional visibility filters; end-users only see user-visible fields.
   */
  async listFields(
    templateId: string,
    user: CurrentUser,
    q: QueryFieldsDto,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const admin = this.supabase.supabaseAdmin;
    const { data: secs, error: secErr } = await admin
      .from('form_sections')
      .select('id')
      .eq('template_id', templateId);
    if (secErr) {
      throwFromPostgrest(secErr, 'SECTION_IDS_FAILED');
    }
    const sectionIds = (secs as { id: string }[] | null)?.map((s) => s.id) ?? [];
    if (!sectionIds.length) {
      return {
        data: [],
        meta: {
          total: 0,
          page: q.page,
          limit: q.limit,
          totalPages: 1,
        },
      };
    }
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;
    let qb = admin
      .from('form_fields')
      .select('*', { count: 'exact' })
      .in('section_id', sectionIds);
    if (q.section_id) {
      qb = qb.eq('section_id', q.section_id);
    }
    if (q.is_active !== undefined) {
      qb = qb.eq('is_active', q.is_active);
    }
    if (user.role === 'user') {
      qb = qb.eq('visible_to_user', true);
    } else if (q.visible_to_user !== undefined) {
      qb = qb.eq('visible_to_user', q.visible_to_user);
    }
    const { data, error, count } = await qb
      .order('display_order', { ascending: true })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'FIELDS_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  /**
   * Adds a dynamic field via DB helper RPC when available, otherwise inserts directly.
   */
  async createField(
    templateId: string,
    dto: CreateFieldDto,
  ): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const { data: section, error: sErr } = await admin
      .from('form_sections')
      .select('id, template_id')
      .eq('id', dto.section_id)
      .maybeSingle();
    if (sErr) {
      throwFromPostgrest(sErr, 'SECTION_LOOKUP_FAILED');
    }
    if (
      !section ||
      (section as { template_id: string }).template_id !== templateId
    ) {
      throw new BadRequestException({
        message: 'Section does not belong to template',
        error: 'SECTION_MISMATCH',
      });
    }

    const rpcPayload = {
      p_template_id: templateId,
      p_section_id: dto.section_id,
      p_field_key: dto.field_key,
      p_field_label: dto.field_label,
      p_data_type: dto.data_type,
      p_is_required: dto.is_required ?? false,
      p_visible_to_user: dto.visible_to_user ?? true,
      p_editable_by_user: dto.editable_by_user ?? true,
      p_display_order: dto.display_order ?? 0,
      p_placeholder: dto.placeholder ?? null,
      p_help_text: dto.help_text ?? null,
      p_options: dto.options ?? null,
      p_max_file_size_mb: dto.max_file_size_mb ?? null,
      p_accepted_file_types: dto.accepted_file_types ?? null,
    };

    const { data: rpcData, error: rpcErr } = await admin.rpc(
      'add_form_field',
      rpcPayload,
    );

    if (!rpcErr && rpcData !== null && rpcData !== undefined) {
      const newId = rpcData as string;
      const { data: row, error: loadErr } = await admin
        .from('form_fields')
        .select('*')
        .eq('id', newId)
        .maybeSingle();
      if (!loadErr && row) {
        return row;
      }
      return { id: newId };
    }

    const { data, error } = await admin
      .from('form_fields')
      .insert({
        template_id: templateId,
        section_id: dto.section_id,
        field_key: dto.field_key,
        field_label: dto.field_label,
        data_type: dto.data_type,
        is_required: dto.is_required ?? false,
        visible_to_user: dto.visible_to_user ?? true,
        editable_by_user: dto.editable_by_user ?? true,
        visible_to_manager: dto.visible_to_manager ?? true,
        editable_by_manager: dto.editable_by_manager ?? true,
        display_order: dto.display_order ?? 0,
        placeholder: dto.placeholder ?? null,
        help_text: dto.help_text ?? null,
        validation_regex: dto.validation_regex ?? null,
        options: dto.options ?? null,
        default_value: dto.default_value ?? null,
        max_file_size_mb: dto.max_file_size_mb ?? null,
        accepted_file_types: dto.accepted_file_types ?? null,
        is_system_field: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throwFromPostgrest(error, 'FIELD_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Updates mutable field metadata; immutable keys stay server-protected.
   */
  async updateField(
    templateId: string,
    fieldId: string,
    dto: UpdateFieldDto,
  ): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const { data: existing, error: eErr } = await admin
      .from('form_fields')
      .select('id, is_system_field, section_id')
      .eq('id', fieldId)
      .maybeSingle();
    if (eErr) {
      throwFromPostgrest(eErr, 'FIELD_LOAD_FAILED');
    }
    if (!existing) {
      throw new NotFoundException({
        message: 'Field not found',
        error: 'FIELD_NOT_FOUND',
      });
    }
    await this.assertFieldInTemplate(
      templateId,
      (existing as { section_id: string }).section_id,
    );

    const { data, error } = await admin
      .from('form_fields')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fieldId)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'FIELD_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Deletes a custom field; system fields are protected.
   */
  async deleteField(templateId: string, fieldId: string): Promise<void> {
    const admin = this.supabase.supabaseAdmin;
    const { data: existing, error: eErr } = await admin
      .from('form_fields')
      .select('is_system_field, section_id')
      .eq('id', fieldId)
      .maybeSingle();
    if (eErr) {
      throwFromPostgrest(eErr, 'FIELD_LOAD_FAILED');
    }
    if (!existing) {
      throw new NotFoundException({
        message: 'Field not found',
        error: 'FIELD_NOT_FOUND',
      });
    }
    await this.assertFieldInTemplate(
      templateId,
      (existing as { section_id: string }).section_id,
    );
    if ((existing as { is_system_field: boolean }).is_system_field) {
      throw new ForbiddenException({
        message: 'Cannot delete system field',
        error: 'SYSTEM_FIELD_PROTECTED',
      });
    }
    const { error } = await admin.from('form_fields').delete().eq('id', fieldId);
    if (error) {
      throwFromPostgrest(error, 'FIELD_DELETE_FAILED');
    }
  }

  async reorderFields(
    templateId: string,
    dto: ReorderFieldsDto,
  ): Promise<{ data: { success: boolean } }> {
    const admin = this.supabase.supabaseAdmin;
    const { data: secs, error: secErr } = await admin
      .from('form_sections')
      .select('id')
      .eq('template_id', templateId);
    if (secErr) {
      throwFromPostgrest(secErr, 'SECTION_IDS_FAILED');
    }
    const sectionIds =
      (secs as { id: string }[] | null)?.map((s) => s.id) ?? [];
    for (const f of dto.fields) {
      const { error } = await admin
        .from('form_fields')
        .update({
          display_order: f.display_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', f.id)
        .in('section_id', sectionIds);
      if (error) {
        throwFromPostgrest(error, 'FIELD_REORDER_FAILED');
      }
    }
    return { data: { success: true } };
  }

  /**
   * Ensures the section belongs to the provided template.
   */
  private async assertFieldInTemplate(
    templateId: string,
    sectionId: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('form_sections')
      .select('id')
      .eq('id', sectionId)
      .eq('template_id', templateId)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'SECTION_VALIDATE_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Field not found for template',
        error: 'FIELD_NOT_FOUND',
      });
    }
  }

  async toggleField(
    templateId: string,
    fieldId: string,
    patch: {
      visible_to_user?: boolean;
      editable_by_user?: boolean;
      is_active?: boolean;
    },
  ): Promise<unknown> {
    return this.updateField(templateId, fieldId, patch as UpdateFieldDto);
  }
}
