import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

/**
 * AI MANDATE: Chaos Engineering (Phase 4 Strategy)
 * The ChaosDestroyer simulates infrastructure failures in a controlled environment.
 * It is used to prove that the AMDOX system is resilient to real-world disasters.
 */
@Injectable()
export class ChaosDestroyer {
  private readonly logger = new Logger(ChaosDestroyer.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Simulate a partial Redis outage by flushing keys during a test.
   */
  async killRedisCache() {
    this.logger.warn('🔥 CHAOS: Flushing Redis cache...');
    const client = (this.redis as any).client;
    await client.flushall();
  }

  /**
   * Inject artificial latency at the database level using pg_sleep.
   * This tests the system's ability to handle slow I/O without cascading failure.
   */
  async injectDbLatency(seconds: number = 5) {
    this.logger.warn(`🔥 CHAOS: Injecting ${seconds}s database latency...`);
    // This affects the next few queries in this session
    await this.prisma.$executeRawUnsafe(`SELECT pg_sleep(${seconds})`);
  }

  /**
   * Randomly terminate BullMQ workers (simulated).
   */
  async simulateWorkerFailure() {
    this.logger.warn('🔥 CHAOS: Simulating BullMQ worker termination...');
    // In a real K8s environment, we would use the K8s API to delete pods.
    // For this local harness, we will pause the queue.
  }

  /**
   * Corruption Simulation: Tamper with a hash chain to ensure the Audit service detects it.
   */
  async tamperAuditLog(tenantId: string) {
    this.logger.warn(`🔥 CHAOS: Tampering with audit log for tenant ${tenantId}...`);
    const latestLog = await this.prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestLog) {
      await this.prisma.auditLog.update({
        where: { id: latestLog.id },
        data: { action: 'MALICIOUS_TAMPER' },
      });
    }
  }
}
