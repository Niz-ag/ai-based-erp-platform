import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('live')
  getLive() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async getReady() {
    try {
      // Check DB connection
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (e) {
      return { status: 'error', database: 'disconnected', message: e.message };
    }
  }
}
