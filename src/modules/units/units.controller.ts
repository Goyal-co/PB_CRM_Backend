import {
  BadRequestException,
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
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '@common/types/user.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { UnitsService } from './units.service';
import { QueryUnitsDto } from './dto/query-units.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { BulkUnitsDto } from './dto/bulk-units.dto';

@ApiTags('units')
@ApiBearerAuth()
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('matrix')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @ApiOperation({ summary: 'Unit matrix by tower' })
  @ApiResponse({ status: 200 })
  async matrix(
    @CurrentUser() user: CurrentUserType,
    @Query('project_id') projectId: string,
  ): Promise<unknown> {
    if (!projectId) {
      throw new BadRequestException({
        message: 'project_id is required',
        error: 'BAD_REQUEST',
      });
    }
    return this.unitsService.matrix(user, projectId);
  }

  @Get()
  @ApiOperation({ summary: 'List units (paginated)' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: CurrentUserType,
    @Query() q: QueryUnitsDto,
  ): Promise<unknown> {
    return this.unitsService.findAll(user, q);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Bulk create units' })
  @ApiResponse({ status: 201 })
  async bulk(@Body() dto: BulkUnitsDto): Promise<unknown> {
    return this.unitsService.bulkInsert(dto.units);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit' })
  @ApiResponse({ status: 200 })
  async one(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.unitsService.findOne(user, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create unit' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateUnitDto): Promise<unknown> {
    return this.unitsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update unit' })
  @ApiResponse({ status: 200 })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<unknown> {
    return this.unitsService.update(id, dto);
  }
}
