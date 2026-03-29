import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { FieldValuesService } from './field-values.service';
import { UpsertFieldValueDto } from './dto/upsert-field-value.dto';
import { BulkFieldValuesDto } from './dto/bulk-field-values.dto';

@ApiTags('field-values')
@ApiBearerAuth()
@Controller('field-values')
export class FieldValuesController {
  constructor(private readonly service: FieldValuesService) {}

  @Get(':bookingId')
  @ApiOperation({ summary: 'All field values keyed by field_key' })
  @ApiResponse({ status: 200 })
  async get(
    @CurrentUser() user: CurrentUserType,
    @Param('bookingId') bookingId: string,
  ): Promise<unknown> {
    const data = await this.service.getByBooking(user, bookingId);
    return { data };
  }

  @Put(':bookingId/bulk')
  @ApiOperation({ summary: 'Bulk upsert field values' })
  @ApiResponse({ status: 200 })
  async putBulk(
    @CurrentUser() user: CurrentUserType,
    @Param('bookingId') bookingId: string,
    @Body() dto: BulkFieldValuesDto,
  ): Promise<unknown> {
    const { count } = await this.service.bulkUpsert(user, bookingId, dto);
    return { data: { count } };
  }

  @Put(':bookingId/:fieldId')
  @ApiOperation({ summary: 'Upsert a single field value' })
  @ApiResponse({ status: 200 })
  async putOne(
    @CurrentUser() user: CurrentUserType,
    @Param('bookingId') bookingId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpsertFieldValueDto,
  ): Promise<unknown> {
    return this.service.upsertOne(user, bookingId, fieldId, dto);
  }
}
