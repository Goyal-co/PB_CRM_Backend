import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Uses Supabase Auth (anon key). Returns JWTs and profile when `profiles` exists and is active.',
  })
  @ApiResponse({ status: 200, description: 'Session issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive user' })
  async login(@Body() dto: LoginDto): Promise<{ data: unknown }> {
    return { data: await this.authService.login(dto) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New session issued' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<{ data: unknown }> {
    return { data: await this.authService.refresh(dto) };
  }

  @Public()
  @Post('bootstrap-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create the first super_admin (one-time setup)',
    description:
      'Requires `BOOTSTRAP_ADMIN_SECRET` in server env. Allowed only while no `super_admin` profile exists. Returns the same session shape as login.',
  })
  @ApiResponse({ status: 201, description: 'Super admin created + session issued' })
  @ApiResponse({ status: 403, description: 'Bootstrap disabled (no env secret)' })
  @ApiResponse({
    status: 409,
    description: 'A super_admin already exists',
  })
  async bootstrapAdmin(
    @Body() dto: BootstrapAdminDto,
  ): Promise<{ data: unknown }> {
    return { data: await this.authService.bootstrapSuperAdmin(dto) };
  }
}
