import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

class DashboardQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('my-summary')
  @UseGuards(RolesGuard)
  @Roles('user')
  @ApiOperation({ summary: 'End-user dashboard: own bookings by status' })
  @ApiResponse({ status: 200 })
  async mySummary(@CurrentUser() user: CurrentUserType): Promise<unknown> {
    return this.service.userMySummary(user);
  }

  @Get('kpis')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Dashboard KPIs (RPC)' })
  @ApiResponse({ status: 200 })
  async kpis(@CurrentUser() user: CurrentUserType): Promise<unknown> {
    return this.service.kpis(user);
  }

  @Get('booking-funnel')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Booking funnel counts' })
  @ApiResponse({ status: 200 })
  async funnel(
    @CurrentUser() user: CurrentUserType,
    @Query('project_id') projectId?: string,
  ): Promise<unknown> {
    return this.service.bookingFunnel(user, projectId);
  }

  @Get('inventory-summary')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Inventory grouped summary' })
  @ApiResponse({ status: 200 })
  async inventory(
    @CurrentUser() user: CurrentUserType,
    @Query('project_id') projectId?: string,
  ): Promise<unknown> {
    return this.service.inventorySummary(user, projectId);
  }

  @Get('recent-activity')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Latest audit activities' })
  @ApiResponse({ status: 200 })
  async activity(
    @CurrentUser() user: CurrentUserType,
    @Query() q: DashboardQuery,
  ): Promise<unknown> {
    return this.service.recentActivity(
      user,
      q.project_id,
      q.limit ?? 10,
    );
  }
}
