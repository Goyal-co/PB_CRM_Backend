import {
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';

export function throwFromPostgrest(
  error: PostgrestError | null,
  defaultCode = 'DATABASE_ERROR',
): never {
  if (!error) {
    throw new InternalServerErrorException({
      message: 'Unexpected empty database error',
      error: defaultCode,
    });
  }

  const message = error.message;
  const code = error.code;
  const details = error.details;

  if (code === 'PGRST116') {
    throw new NotFoundException({ message, error: 'NOT_FOUND', details });
  }
  if (code === '23505') {
    throw new ConflictException({ message, error: 'DUPLICATE', details });
  }
  if (code === '42501') {
    throw new ForbiddenException({ message, error: 'RLS_FORBIDDEN', details });
  }

  throw new InternalServerErrorException({
    message,
    error: defaultCode,
    details,
  });
}

export function mapRpcError(err: unknown, fallbackMessage: string): never {
  if (typeof err === 'string') {
    throw new UnprocessableEntityException({
      message: err,
      error: 'RPC_ERROR',
    });
  }
  if (err instanceof Error) {
    throw new UnprocessableEntityException({
      message: err.message || fallbackMessage,
      error: 'RPC_ERROR',
    });
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message?: string; code?: string };
    throw new UnprocessableEntityException({
      message: (typeof e.message === 'string' && e.message) || fallbackMessage,
      error: e.code || 'RPC_ERROR',
    });
  }
  throw new InternalServerErrorException({
    message: fallbackMessage,
    error: 'RPC_ERROR',
    details: err != null ? String(err) : undefined,
  });
}

export function asHttpException(
  err: unknown,
  status: number,
  code: string,
  message: string,
): HttpException {
  if (err instanceof HttpException) {
    return err;
  }
  return new HttpException({ message, error: code, details: err }, status);
}

export { PayloadTooLargeException, UnprocessableEntityException };
