import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { RFQController } from './rfq.controller';
import { RFQService } from './rfq.service';
import { PrismaModule } from '../common/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, WebhooksModule, NotificationsModule],
  controllers: [PurchaseOrdersController, RFQController],
  providers: [PurchaseOrdersService, RFQService],
  exports: [PurchaseOrdersService, RFQService],
})
export class PurchaseOrdersModule {}