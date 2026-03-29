import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CurrentUser } from '@common/types/user.types';
import { ProjectsService } from './projects.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const superAdmin = {
    id: 'admin-1',
    email: 'a@test',
    role: 'super_admin' as const,
    profile: { id: 'admin-1', email: 'a@test', role: 'super_admin' },
  } as CurrentUser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            () => ({
              supabase: {
                url: 'https://test.supabase.co',
                anonKey: 'anon',
                serviceRoleKey: 'service',
              },
            }),
          ],
        }),
      ],
      providers: [
        ProjectsService,
        {
          provide: SupabaseService,
          useValue: {
            supabaseAdmin: {
              from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                  count: 0,
                }),

                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                single: jest.fn().mockResolvedValue({ data: {}, error: null }),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                delete: jest.fn().mockReturnThis(),
              }),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ProjectsService);
  });

  it('findAll returns paginated shape', async () => {
    const result = await service.findAll(superAdmin, 1, 20);
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });
});
