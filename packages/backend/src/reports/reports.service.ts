import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReportStatus } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';
import { Parser } from 'json2csv';

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
        type: type, // Store the original type
        schedule: 'adhoc',
        status: ReportStatus.GENERATING,
        lastRun: new Date(),
        tenant: { connect: { id: tenantId } },
      },
    });

    // Simulate async generation in background
    this.processReport(report.id, type, tenantId).catch(console.error);

    return { id: report.id, type, status: 'generating', message: 'Report generation started' };
  }

  async schedule(type: string, schedule: string) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    return this.prisma.report.create({
      data: {
        name: `${type.replace('_', ' ').toUpperCase()} Scheduled`,
        type: type,
        schedule: schedule,
        status: ReportStatus.COMPLETED, // Mark as ready immediately for the UI list
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  private async processReport(id: string, type: string, tenantId: string) {
    try {
      // Artificial delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      let data = [];
      switch (type.toLowerCase()) {
        case 'employees':
          data = await this.prisma.employee.findMany({ where: { tenantId } });
          break;
        case 'inventory':
          data = await this.prisma.inventory.findMany({ 
            where: { tenantId },
            include: { product: true }
          });
          // Flatten data for CSV
          data = data.map(item => ({
            sku: item.product.sku,
            productName: item.product.name,
            quantity: item.quantity,
            reserved: item.reserved
          }));
          break;
        case 'purchase_orders':
        case 'pos':
          data = await this.prisma.purchaseOrder.findMany({ 
            where: { tenantId },
            include: { vendor: true }
          });
          data = data.map(po => ({
            orderNumber: po.orderNumber,
            vendor: po.vendor.name,
            status: po.status,
            totalAmount: po.totalAmount,
            createdAt: po.createdAt
          }));
          break;
        default:
          data = [{ message: 'No data available for this report type' }];
      }

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(data);

      await this.prisma.report.update({
        where: { id },
        data: {
          status: ReportStatus.COMPLETED,
          content: csv,
          url: `/api/v1/reports/${id}/download?format=csv`,
        },
      });
    } catch (error) {
      console.error('Report generation failed:', error);
      await this.prisma.report.update({
        where: { id },
        data: { status: ReportStatus.FAILED },
      });
    }
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async getReportFile(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });
    if (!report || report.status !== ReportStatus.COMPLETED) {
      throw new NotFoundException('Report not ready or not found');
    }
    return {
      content: report.content,
      filename: `${report.name.replace(/\s+/g, '_')}_${report.id}.csv`
    };
  }

  async generateDownload(id: string, format: string) {
    return { downloadUrl: `/api/v1/reports/${id}/download?format=${format}` };
  }
}