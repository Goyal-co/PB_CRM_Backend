import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit log (paginated)' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryAuditDto,
  ): Promise<unknown> {
    return this.service.list(user, q);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Audit trail for booking' })
  @ApiResponse({ status: 200 })
  async booking(
    @CurrentUser() user: CurrentUserType,
    @Param('bookingId') bookingId: string,
  ): Promise<unknown> {
    return this.service.forBooking(user, bookingId);
  }
}
