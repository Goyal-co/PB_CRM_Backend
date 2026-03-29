import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@common/types/supabase.types';

const TERMINAL: BookingStatus[] = [
  'cancelled',
  'rejected',
  'registered',
  'possession_taken',
];

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL.includes(status);
}

const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
  submitted: ['draft', 'revision_requested'],
  under_review: ['submitted'],
  approved: ['under_review'],
  agreement_generated: ['approved'],
  agreement_printed: ['agreement_generated'],
  agreement_signed: ['agreement_printed'],
  active: ['agreement_signed'],
  registered: ['possession_taken', 'active', 'possession_offered'],
  cancelled: [], // from any non-terminal — handled separately
  rejected: ['submitted', 'under_review'],
};

/**
 * Validates allowed booking status transitions used when mutating lifecycle state from the API.
 */
export function assertBookingStatusTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (from === to) {
    return;
  }
  if (to === 'cancelled') {
    if (isTerminalBookingStatus(from)) {
      throw new BadRequestException({
        message: `Cannot cancel booking in status ${from}`,
        error: 'INVALID_STATUS_TRANSITION',
      });
    }
    return;
  }
  const allowedFrom = transitions[to];
  if (!allowedFrom || !allowedFrom.includes(from)) {
    throw new BadRequestException({
      message: `Invalid status transition from ${from} to ${to}`,
      error: 'INVALID_STATUS_TRANSITION',
    });
  }
}
