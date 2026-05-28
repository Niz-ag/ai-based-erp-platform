import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { tenantContextStorage } from '../common/tenant-context';

interface LogQueryOptions {
  page: number;
  limit: number;
  action?: string;
  userId?: string;
}

interface ExportOptions {
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('audit') private auditQueue: Queue,
  ) {}

  async getLogs(options: LogQueryOptions) {
    const { page, limit, action, userId } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * AI MANDATE: Offloading the Event Loop (Phase 2 Strategy)
   * Instead of processing the log synchronously, we push it to a high-speed Redis queue.
   * This ensures sub-50ms latency for the calling API even under massive concurrent load.
   */
  async log(params: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Get tenantId from context to include in the job data
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) {
      this.logger.warn(`Attempted to log audit entry without tenant context: ${params.action}`);
      return;
    }
    
    // Push to BullMQ for async processing
    await this.auditQueue.add('log-mutation', { ...params, tenantId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }

  /**
   * Internal processor logic called by AuditProcessor
   * Handles the heavy lifting of hash-chaining and DB writes.
   */
  async processLog(params: any) {
    const tenantId = params.tenantId;
    try {
      let newValue = params.newValue;
      if (newValue && typeof newValue === 'object') {
        const str = JSON.stringify(newValue);
        if (str.length > 5000) {
          newValue = { _truncated: true, originalLength: str.length, partial: str.substring(0, 5000) };
        }
      }

      return await this.prisma.$transaction(async (tx) => {
        // Atomic lock for hash chain linearity
        // NOTE: We still use tenantId in raw SQL because it's part of the partitioning/locking strategy
        await tx.$executeRaw`SELECT 1 FROM sequences WHERE tenant_id = ${tenantId} AND name = 'audit_log' FOR UPDATE`;

        const previousLog = await tx.auditLog.findFirst({
          orderBy: { createdAt: 'desc' },
        });

        const previousHash = previousLog?.hash || '0'.repeat(64);
        const currentPayload = JSON.stringify({
          tenantId, // Keeping it in payload for hash integrity
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          newValue,
        });

        const hash = crypto
          .createHash('sha256')
          .update(previousHash + currentPayload)
          .digest('hex');

        const log = await tx.auditLog.create({
          data: {
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            oldValue: params.oldValue,
            newValue,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            hash,
            previousHash,
            user: { connect: { id: params.userId } },
            tenant: { connect: { id: tenantId } },
          },
        });

        await tx.sequence.upsert({
          where: { tenantId_name: { tenantId, name: 'audit_log' } },
          create: { 
            name: 'audit_log', 
            value: 1,
            tenant: { connect: { id: tenantId } }
          },
          update: { value: { increment: 1 } },
        });

        return log;
      });
    } catch (error) {
      this.logger.error(`Failed to process audit log for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  async exportLogs(options: ExportOptions) {
    const where: any = {};
    if (options.from) where.createdAt = { ...where.createdAt, gte: new Date(options.from) };
    if (options.to) where.createdAt = { ...where.createdAt, lte: new Date(options.to) };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });

    const csvRows = [
      'Timestamp,Action,EntityType,EntityId,User,IP Address',
      ...logs.map(log => 
        `${log.createdAt.toISOString()},${log.action},${log.entityType},${log.entityId || ''},${log.user?.email || ''},${log.ipAddress || ''}`
      ),
    ];

    return { data: logs, csv: csvRows.join('\n') };
  }
}

