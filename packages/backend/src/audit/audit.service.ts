import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';

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
  constructor(private prisma: PrismaService) {}

  async getLogs(tenantId: string, options: LogQueryOptions) {
    const { page, limit, action, userId } = options;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
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

  async exportLogs(tenantId: string, options: ExportOptions) {
    const where: any = { tenantId };
    if (options.from) where.createdAt = { ...where.createdAt, gte: new Date(options.from) };
    if (options.to) where.createdAt = { ...where.createdAt, lte: new Date(options.to) };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });

    // Convert to CSV format
    const csvRows = [
      'Timestamp,Action,EntityType,EntityId,User,IP Address',
      ...logs.map(log => 
        `${log.createdAt.toISOString()},${log.action},${log.entityType},${log.entityId || ''},${log.user?.email || ''},${log.ipAddress || ''}`
      ),
    ];

    return { data: logs, csv: csvRows.join('\n') };
  }

  async log(params: {
    tenantId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Sanitize and truncate newValue to prevent bloat
    let newValue = params.newValue;
    if (newValue && typeof newValue === 'object') {
      const str = JSON.stringify(newValue);
      if (str.length > 5000) {
        newValue = { _truncated: true, originalLength: str.length, partial: str.substring(0, 5000) };
      }
    }

    // Hash Chaining for Tamper-Evidence (Requirement F-09)
    const previousLog = await this.prisma.auditLog.findFirst({
      where: { tenantId: params.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const previousHash = previousLog?.hash || '0'.repeat(64);
    const currentPayload = JSON.stringify({
      tenantId: params.tenantId,
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

    return this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue,
        newValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        hash,
        previousHash,
      },
    });
  }
}
