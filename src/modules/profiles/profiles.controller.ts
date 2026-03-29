import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryProfilesDto } from './dto/query-profiles.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  @ApiResponse({ status: 200 })
  async me(@Req() req: FastifyRequest): Promise<unknown> {
    return this.profilesService.getMe(req.accessToken!);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200 })
  async patchMe(
    @Req() req: FastifyRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<unknown> {
    return this.profilesService.updateMe(req.accessToken!, dto);
  }

  @Get('managers')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'List managers with project ids' })
  @ApiResponse({ status: 200 })
  async managers(): Promise<unknown> {
    const data = await this.profilesService.listManagers();
    return { data, meta: { total: data.length } };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'List profiles (super_admin)' })
  @ApiResponse({ status: 200 })
  async list(@Query() q: QueryProfilesDto): Promise<unknown> {
    return this.profilesService.findAll({
      page: q.page,
      limit: q.limit,
      role: q.role,
      is_active: q.is_active,
      search: q.search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile by id' })
  @ApiResponse({ status: 200 })
  async one(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.profilesService.findOne(user, id);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update profile role' })
  @ApiResponse({ status: 200 })
  async role(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<unknown> {
    return this.profilesService.updateRole(id, dto.role);
  }

  @Patch(':id/assign-manager')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Assign manager to user' })
  @ApiResponse({ status: 200 })
  async assign(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
  ): Promise<unknown> {
    return {
      data: await this.profilesService.assignManager(
        req.accessToken!,
        id,
        dto,
      ),
    };
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Deactivate profile' })
  @ApiResponse({ status: 200 })
  async deactivate(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.profilesService.deactivate(id);
  }
}
