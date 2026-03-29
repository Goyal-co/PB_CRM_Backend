import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { PaymentsService } from './payments.service';
import { QueryPaymentsDto, CollectionsQueryDto } from './dto/query-payments.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { DemandPaymentDto } from './dto/demand-payment.dto';
import { InterestDto } from './dto/interest.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('collections')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Monthly cleared collections' })
  @ApiResponse({ status: 200 })
  async collections(
    @CurrentUser() user: CurrentUserType,
    @Query() q: CollectionsQueryDto,
  ): Promise<unknown> {
    return this.service.collections(user, {
      year: q.year,
      project_id: q.project_id,
      month: q.month,
    });
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Payment summary RPC' })
  @ApiResponse({ status: 200 })
  async summary(
    @CurrentUser() user: CurrentUserType,
    @Param('bookingId') bookingId: string,
  ): Promise<unknown> {
    return this.service.summary(user, bookingId);
  }

  @Get()
  @ApiOperation({ summary: 'List payments' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryPaymentsDto,
  ): Promise<unknown> {
    return this.service.list(user, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Payment detail' })
  @ApiResponse({ status: 200 })
  async one(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.findOne(user, id);
  }

  @Patch(':id/record')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Record receipt' })
  @ApiResponse({ status: 200 })
  async record(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<unknown> {
    return this.service.record(user, id, dto);
  }

  @Patch(':id/clear')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Mark cleared' })
  @ApiResponse({ status: 200 })
  async clear(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.clear(user, id);
  }

  @Patch(':id/bounce')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Mark bounced + fee' })
  @ApiResponse({ status: 200 })
  async bounce(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.bounce(user, id);
  }

  @Patch(':id/demand')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Demand payment + notify user' })
  @ApiResponse({ status: 200 })
  async demand(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: DemandPaymentDto,
  ): Promise<unknown> {
    return this.service.demand(user, id, dto);
  }

  @Patch(':id/interest')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Apply interest terms' })
  @ApiResponse({ status: 200 })
  async interest(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: InterestDto,
  ): Promise<unknown> {
    return this.service.interest(user, id, dto);
  }
}
