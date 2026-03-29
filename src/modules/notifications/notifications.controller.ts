import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

class NotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  is_read?: 'true' | 'false';
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My notifications' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: NotificationQueryDto,
  ): Promise<unknown> {
    const isRead =
      q.is_read === undefined ? undefined : q.is_read === 'true';
    return this.service.listForUser(
      user.id,
      q.page,
      q.limit,
      isRead,
    );
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications read' })
  @ApiResponse({ status: 200 })
  async readAll(
    @CurrentUser() user: CurrentUserType,
  ): Promise<unknown> {
    return this.service.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification read' })
  @ApiResponse({ status: 200 })
  async readOne(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.markRead(user.id, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Create notification' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateNotificationDto): Promise<unknown> {
    return this.service.createNotification(dto);
  }
}
