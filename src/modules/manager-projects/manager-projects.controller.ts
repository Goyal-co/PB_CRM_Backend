import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { ManagerProjectsService } from './manager-projects.service';
import { CreateManagerProjectDto } from './dto/create-manager-project.dto';

@ApiTags('manager-projects')
@ApiBearerAuth()
@Controller('manager-projects')
export class ManagerProjectsController {
  constructor(private readonly service: ManagerProjectsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'List manager–project assignments' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query('manager_id') managerId?: string,
    @Query('project_id') projectId?: string,
  ): Promise<unknown> {
    const rows = await this.service.list(user, managerId, projectId);
    return { data: rows, meta: { total: rows.length } };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create assignment' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateManagerProjectDto): Promise<unknown> {
    return this.service.create(dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete assignment' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string): Promise<unknown> {
    const data = await this.service.remove(id);
    return { data };
  }
}
