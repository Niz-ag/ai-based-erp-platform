import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../common/prisma.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WebhooksModule, NotificationsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PrismaService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}