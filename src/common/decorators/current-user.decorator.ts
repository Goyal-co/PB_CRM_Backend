import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserType | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserType }>();
    return request.user;
  },
);
