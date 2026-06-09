import { Module, OnModuleInit } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ReplenishmentService } from './replenishment.service';
import { ReplenishmentController } from './replenishment.controller';
import { PrismaService } from '../common/prisma.service';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LowStockProcessor } from './low-stock.processor';
import { ForecastModule } from '../forecast/forecast.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'inventory',
    }),
    ForecastModule,
  ],
  controllers: [InventoryController, ReplenishmentController],
  providers: [InventoryService, ReplenishmentService, PrismaService, LowStockProcessor],
  exports: [InventoryService, ReplenishmentService],
})
export class InventoryModule implements OnModuleInit {
  constructor(@InjectQueue('inventory') private inventoryQueue: Queue) {}

  async onModuleInit() {
    // Register repeatable job for low stock check (every hour)
    await this.inventoryQueue.add(
      'check-low-stock',
      {},
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at minute 0
        },
      },
    );
  }
}