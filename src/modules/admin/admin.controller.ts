import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { AssignManagerDto } from '@modules/profiles/dto/assign-manager.dto';
import { AdminService } from './admin.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AssignProjectBodyDto } from './dto/assign-project-body.dto';
import { RevokeUserBodyDto } from './dto/revoke-user-body.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('invitations')
  @ApiOperation({
    summary:
      'Record admin invitation (optional: send Supabase invite when ADMIN_SEND_INVITE_EMAIL=1)',
  })
  @ApiResponse({ status: 201 })
  async createInvitation(
    @Req() req: FastifyRequest,
    @Body() dto: CreateInvitationDto,
  ): Promise<unknown> {
    return {
      data: await this.adminService.createInvitation(req.accessToken!, dto),
    };
  }

  @Post('users/:userId/project-assignments')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign manager or user to a project' })
  @ApiResponse({ status: 200 })
  async assignProject(
    @Req() req: FastifyRequest,
    @Param('userId') userId: string,
    @Body() dto: AssignProjectBodyDto,
  ): Promise<unknown> {
    return {
      data: await this.adminService.assignProject(
        req.accessToken!,
        userId,
        dto.project_id,
      ),
    };
  }

  @Delete('users/:userId/project-assignments/:projectId')
  @ApiOperation({ summary: 'Remove manager/user project assignment' })
  @ApiResponse({ status: 200 })
  async removeProject(
    @Req() req: FastifyRequest,
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
  ): Promise<unknown> {
    return {
      data: await this.adminService.removeProject(
        req.accessToken!,
        userId,
        projectId,
      ),
    };
  }

  @Patch('users/:userId/manager')
  @ApiOperation({ summary: 'Assign manager to user (admin_assign_manager_to_user)' })
  @ApiResponse({ status: 200 })
  async assignManager(
    @Req() req: FastifyRequest,
    @Param('userId') userId: string,
    @Body() dto: AssignManagerDto,
  ): Promise<unknown> {
    return {
      data: await this.adminService.assignManagerToUser(
        req.accessToken!,
        userId,
        dto,
      ),
    };
  }

  @Get('users-directory')
  @ApiOperation({ summary: 'Admin user list (get_admin_user_list)' })
  @ApiResponse({ status: 200 })
  async userDirectory(
    @Req() req: FastifyRequest,
    @Query() q: QueryAdminUsersDto,
  ): Promise<unknown> {
    return {
      data: await this.adminService.getUserDirectory(req.accessToken!, {
        role: q.role,
        project_id: q.project_id,
        is_active: q.is_active,
        search: q.search,
        page: q.page,
        limit: q.limit,
      }),
    };
  }

  @Get('projects/:projectId/user-summary')
  @ApiOperation({ summary: 'Project roster (get_project_user_summary)' })
  @ApiResponse({ status: 200 })
  async projectUserSummary(
    @Req() req: FastifyRequest,
    @Param('projectId') projectId: string,
  ): Promise<unknown> {
    return {
      data: await this.adminService.getProjectUserSummary(
        req.accessToken!,
        projectId,
      ),
    };
  }

  @Post('users/:userId/revoke')
  @ApiOperation({ summary: 'Deactivate profile and project access' })
  @ApiResponse({ status: 200 })
  async revoke(
    @Req() req: FastifyRequest,
    @Param('userId') userId: string,
    @Body() dto: RevokeUserBodyDto,
  ): Promise<unknown> {
    return {
      data: await this.adminService.revokeUser(
        req.accessToken!,
        userId,
        dto.reason,
      ),
    };
  }

  @Post('users/:userId/reactivate')
  @ApiOperation({ summary: 'Reactivate profile' })
  @ApiResponse({ status: 200 })
  async reactivate(
    @Req() req: FastifyRequest,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    return {
      data: await this.adminService.reactivateUser(req.accessToken!, userId),
    };
  }
}
