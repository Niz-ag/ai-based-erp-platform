import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { EventBusService } from './event-bus.service';
import { FileService } from './file.service';
import { FileCleanupService } from './file-cleanup.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, EventBusService, FileService, FileCleanupService],
  exports: [PrismaService, RedisService, EventBusService, FileService, FileCleanupService],
})
export class PrismaModule {}
