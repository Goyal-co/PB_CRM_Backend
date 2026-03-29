import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import supabaseConfig from './config/supabase.config';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ManagerProjectsModule } from './modules/manager-projects/manager-projects.module';
import { UnitsModule } from './modules/units/units.module';
import { FormTemplatesModule } from './modules/form-templates/form-templates.module';
import { AgreementTemplatesModule } from './modules/agreement-templates/agreement-templates.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { FieldValuesModule } from './modules/field-values/field-values.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, supabaseConfig],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl:
              (config.get<number>('app.throttleTtl', { infer: true }) ?? 60) *
              1000,
            limit:
              config.get<number>('app.throttleLimit', { infer: true }) ?? 100,
          },
        ],
      }),
    }),
    SupabaseModule,
    AuthModule,
    ProjectsModule,
    ProfilesModule,
    ManagerProjectsModule,
    UnitsModule,
    FormTemplatesModule,
    AgreementTemplatesModule,
    BookingsModule,
    FieldValuesModule,
    DocumentsModule,
    PaymentsModule,
    NotificationsModule,
    DashboardModule,
    AuditModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AppModule {}
