import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReportStatus } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const reports = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { data: reports };
  }

  async generate(type: string) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    const report = await this.prisma.report.create({
      data: {
        name: `${type.replace('_', ' ').toUpperCase()} Report`,
        type: type.includes('loss') || type.includes('balance') ? 'Financial' : 'Operations',
        schedule: 'adhoc',
        status: ReportStatus.GENERATING,
        lastRun: new Date(),
        tenant: { connect: { id: tenantId } },
      },
    });

    // Simulate async generation in background (in production, this would be a BullMQ job)
    this.processReport(report.id).catch(console.error);

    return { id: report.id, type, status: 'generating', message: 'Report generation started' };
  }

  private async processReport(id: string) {
    // Artificial delay to simulate heavy processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.COMPLETED,
        url: `/api/reports/${id}/download/pdf`, // Mock download URL
      },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async generateDownload(id: string, format: string) {
    return { downloadUrl: `/api/reports/${id}/download/${format}` };
  }
}