import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List active projects (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated projects' })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: PaginationDto,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    return this.projectsService.findAll(user, q.page, q.limit);
  }

  @Get('my')
  @ApiOperation({ summary: 'Projects assigned to current user (get_my_projects RPC)' })
  @ApiResponse({ status: 200 })
  async myProjects(@Req() req: FastifyRequest): Promise<unknown> {
    return { data: await this.projectsService.getMyProjects(req.accessToken!) };
  }

  @Get(':id/stats')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Project KPI stats' })
  @ApiResponse({ status: 200 })
  async stats(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.projectsService.stats(user, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by id' })
  @ApiResponse({ status: 200 })
  async getOne(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.projectsService.findOne(user, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create project (super_admin)' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateProjectDto): Promise<unknown> {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update project (super_admin)' })
  @ApiResponse({ status: 200 })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<unknown> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Soft-delete project' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.projectsService.softDelete(id);
  }
}
