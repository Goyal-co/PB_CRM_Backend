import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { BookingsService } from './bookings.service';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ReviewFieldDto } from './dto/review-field.dto';
import { CompleteReviewDto } from './dto/complete-review.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { PossessionDto } from './dto/possession.dto';
import { RegistrationDto } from './dto/registration.dto';
import { RecordAgreementDto } from './dto/record-agreement.dto';
import { QueryWorkspaceBookingsDto } from './dto/query-workspace-bookings.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get('pending-review')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Submitted bookings awaiting review' })
  @ApiResponse({ status: 200 })
  async pending(@CurrentUser() user: CurrentUserType): Promise<unknown> {
    return this.service.pendingReview(user);
  }

  @Get('workspace')
  @ApiOperation({ summary: 'Bookings in my assigned projects (get_bookings_for_my_projects)' })
  @ApiResponse({ status: 200 })
  async workspace(
    @Req() req: FastifyRequest,
    @Query() q: QueryWorkspaceBookingsDto,
  ): Promise<unknown> {
    return {
      data: await this.service.workspaceForCaller(req.accessToken!, {
        status: q.status,
        project_id: q.project_id,
        search: q.search,
        page: q.page,
        limit: q.limit,
      }),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Booking list (role filtered)' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryBookingsDto,
  ): Promise<unknown> {
    return this.service.list(user, q);
  }

  @Post()
  @ApiOperation({ summary: 'Create draft booking' })
  @ApiResponse({ status: 201 })
  async create(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: CreateBookingDto,
  ): Promise<unknown> {
    return this.service.create(user, dto);
  }

  @Get(':id/form')
  @ApiOperation({ summary: 'Booking form payload (RPC)' })
  @ApiResponse({ status: 200 })
  async form(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getForm(user, id, req.accessToken!);
  }

  @Get(':id/merged-agreement')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Merged agreement HTML' })
  @ApiResponse({ status: 200 })
  async merged(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.mergedAgreement(user, id, req.accessToken!);
  }

  @Get(':id/agreement-download')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['pdf', 'html'],
    description: 'Defaults to pdf. Use html for a raw HTML file instead.',
  })
  @ApiOperation({
    summary: 'Download merged agreement as PDF',
    description:
      'Returns application/pdf by default (headless Chromium). Pass ?format=html for an HTML attachment.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 503, description: 'PDF engine unavailable' })
  async agreementDownload(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    const wantHtml = format?.toLowerCase() === 'html';
    if (wantHtml) {
      const buf = await this.service.agreementDownloadHtml(user, id);
      return new StreamableFile(buf, {
        type: 'text/html; charset=utf-8',
        disposition: `attachment; filename="agreement-${id}.html"`,
      });
    }
    const buf = await this.service.agreementDownloadPdf(user, id);
    return new StreamableFile(buf, {
      type: 'application/pdf',
      disposition: `attachment; filename="agreement-${id}.pdf"`,
    });
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit booking (RPC)' })
  @ApiResponse({ status: 200 })
  async submit(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.submit(user, id, req.accessToken!);
  }

  @Post(':id/start-review')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Start manager review (RPC)' })
  @ApiResponse({ status: 200 })
  async start(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.startReview(user, id, req.accessToken!);
  }

  @Patch(':id/review-field')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Review single field (RPC)' })
  @ApiResponse({ status: 200 })
  async reviewField(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: ReviewFieldDto,
  ): Promise<unknown> {
    return this.service.reviewField(user, id, dto, req.accessToken!);
  }

  @Patch(':id/complete-review')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Complete review (RPC)' })
  @ApiResponse({ status: 200 })
  async complete(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: CompleteReviewDto,
  ): Promise<unknown> {
    return this.service.completeReview(user, id, dto, req.accessToken!);
  }

  @Post(':id/record-agreement')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Record generated agreement (RPC)' })
  @ApiResponse({ status: 200 })
  async record(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: RecordAgreementDto,
  ): Promise<unknown> {
    return this.service.recordAgreement(user, id, dto, req.accessToken!);
  }

  @Patch(':id/mark-printed')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Mark agreement printed (RPC)' })
  @ApiResponse({ status: 200 })
  async printed(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.markPrinted(user, id, req.accessToken!);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiResponse({ status: 200 })
  async cancel(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ): Promise<unknown> {
    return this.service.cancel(user, id, dto);
  }

  @Patch(':id/possession')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Update possession tracking' })
  @ApiResponse({ status: 200 })
  async possession(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: PossessionDto,
  ): Promise<unknown> {
    return this.service.possession(user, id, dto);
  }

  @Patch(':id/registration')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Mark registration complete' })
  @ApiResponse({ status: 200 })
  async registration(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: RegistrationDto,
  ): Promise<unknown> {
    return this.service.registration(user, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Booking detail' })
  @ApiResponse({ status: 200 })
  async one(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update draft/revision communication fields' })
  @ApiResponse({ status: 200 })
  async patch(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ): Promise<unknown> {
    return this.service.update(user, id, dto);
  }
}
