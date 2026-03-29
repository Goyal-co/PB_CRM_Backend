import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('BookingsService', () => {
  let service: BookingsService;
  const adminFrom = jest.fn();

  beforeEach(async () => {
    adminFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'b1', status: 'draft', user_id: 'u1', project_id: 'p1' },
        error: null,
      }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'new' }, error: null }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: SupabaseService,
          useValue: {
            supabaseAdmin: {
              from: adminFrom,
              rpc: jest
                .fn()
                .mockResolvedValue({ data: { success: true }, error: null }),
            },
          },
        },
        {
          provide: NotificationsService,
          useValue: { notifyUser: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  it('pendingReview forbids end users', async () => {
    await expect(
      service.pendingReview({
        id: 'u1',
        email: 'a@b.com',
        role: 'user',
        profile: { id: 'u1' } as never,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
