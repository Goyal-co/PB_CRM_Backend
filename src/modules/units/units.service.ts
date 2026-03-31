import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { assertManagerCanAccessProject } from '@common/utils/access.util';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { QueryUnitsDto } from './dto/query-units.dto';
import { TowerName } from '@common/types/supabase.types';

@Injectable()
export class UnitsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Paginated units with role-aware filtering (service role + app rules; not RLS-scoped anon).
   */
  async findAll(
    user: CurrentUser,
    q: QueryUnitsDto,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const admin = this.supabase.supabaseAdmin;
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;

    let managerProjectIds: string[] | null = null;
    if (user.role === 'manager') {
      const { data: mp, error: mpErr } = await admin
        .from('manager_projects')
        .select('project_id')
        .eq('manager_id', user.id);
      if (mpErr) {
        throwFromPostgrest(mpErr, 'UNITS_LIST_FAILED');
      }
      managerProjectIds = [
        ...new Set(
          (mp as { project_id: string }[] | null)?.map((r) => r.project_id) ?? [],
        ),
      ];
      if (!managerProjectIds.length) {
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
      if (q.project_id) {
        await assertManagerCanAccessProject(this.supabase, user, q.project_id);
      }
    }

    let qb = admin.from('units').select('*', { count: 'exact' });
    if (user.role === 'manager') {
      qb = qb.in('project_id', managerProjectIds!);
    }
    if (q.project_id) {
      qb = qb.eq('project_id', q.project_id);
    }
    if (q.tower) {
      qb = qb.eq('tower', q.tower);
    }
    if (q.unit_type) {
      qb = qb.eq('unit_type', q.unit_type);
    }
    if (user.role === 'user') {
      qb = qb.eq('status', 'available');
      // Users should never see inventory that is temporarily blocked.
      qb = qb.neq('is_blocked', true);
    } else if (q.status) {
      qb = qb.eq('status', q.status);
      // When filtering to "available", hide rows explicitly blocked by ops.
      if (q.status === 'available') {
        qb = qb.neq('is_blocked', true);
      }
    }
    const { data, error, count } = await qb
      .order('tower', { ascending: true })
      .order('floor_no', { ascending: true })
      .order('unit_no', { ascending: true })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'UNITS_LIST_FAILED');
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
   * Unit grid rows grouped by tower for UI matrix widgets.
   */
  async matrix(
    user: CurrentUser,
    projectId: string,
  ): Promise<Record<TowerName | string, unknown[]>> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Matrix view is restricted',
        error: 'FORBIDDEN',
      });
    }
    if (user.role === 'manager') {
      await assertManagerCanAccessProject(this.supabase, user, projectId);
    }
    const { data, error } = await this.supabase.supabaseAdmin
      .from('v_unit_matrix')
      .select('*')
      .eq('project_id', projectId);
    if (error) {
      throwFromPostgrest(error, 'UNIT_MATRIX_FAILED');
    }
    const grouped: Record<string, unknown[]> = { A: [], B: [], C: [], D: [], E: [] };
    for (const row of data ?? []) {
      const t = String((row as { tower: string }).tower ?? 'A');
      if (!grouped[t]) {
        grouped[t] = [];
      }
      grouped[t].push(row);
    }
    return grouped;
  }

  /**
   * Single unit (service role + role rules).
   */
  async findOne(user: CurrentUser, id: string): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const { data, error } = await admin
      .from('units')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'UNIT_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Unit not found',
        error: 'UNIT_NOT_FOUND',
      });
    }
    const row = data as { project_id: string; status: string };
    if (user.role === 'super_admin') {
      return data;
    }
    if (user.role === 'user') {
      if (row.status !== 'available') {
        throw new NotFoundException({
          message: 'Unit not found',
          error: 'UNIT_NOT_FOUND',
        });
      }
      return data;
    }
    if (user.role === 'manager') {
      await assertManagerCanAccessProject(this.supabase, user, row.project_id);
      return data;
    }
    throw new ForbiddenException({
      message: 'Insufficient permissions',
      error: 'FORBIDDEN',
    });
  }

  /**
   * Inserts a unit row using the service role (super_admin API only).
   */
  async create(dto: CreateUnitDto): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('units')
      .insert({
        ...dto,
        status: 'available',
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'UNIT_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Updates inventory attributes for a unit.
   */
  async update(id: string, dto: UpdateUnitDto): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('units')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          message: 'Unit not found',
          error: 'UNIT_NOT_FOUND',
        });
      }
      throwFromPostgrest(error, 'UNIT_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Bulk-creates units, skipping duplicates per unique tower/floor/unit constraints.
   */
  async bulkInsert(
    units: CreateUnitDto[],
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    for (const u of units) {
      const { error } = await this.supabase.supabaseAdmin
        .from('units')
        .insert({
          ...u,
          status: 'available',
        });
      if (error?.code === '23505') {
        skipped += 1;
        continue;
      }
      if (error) {
        throwFromPostgrest(error, 'UNIT_BULK_INSERT_FAILED');
      }
      inserted += 1;
    }
    return { inserted, skipped };
  }
}
