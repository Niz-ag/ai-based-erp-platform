import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { VendorsModule } from './vendors/vendors.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectsModule } from './projects/projects.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ForecastModule } from './forecast/forecast.module';
import { OcrModule } from './ocr/ocr.module';
import { KeycloakModule } from './auth/keycloak/keycloak.module';
import { PayrollModule } from './payroll/payroll.module';
import { AuditModule } from './audit/audit.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'amdox-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    FinanceModule,
    DepartmentsModule,
    EmployeesModule,
    LeaveRequestsModule,
    VendorsModule,
    ProductsModule,
    InventoryModule,
    PurchaseOrdersModule,
    NotificationsModule,
    ProjectsModule,
    DashboardModule,
    ForecastModule,
    OcrModule,
    KeycloakModule,
    PayrollModule,
    AuditModule,
    WebhooksModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
