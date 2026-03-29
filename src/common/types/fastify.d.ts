import type { CurrentUser } from './user.types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: CurrentUser;
    accessToken?: string;
  }
}

export {};
