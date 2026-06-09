import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

export interface DataPoint {
  date: string;
  quantity: number;
}

export interface ForecastResult {
  sku: string;
  forecasts: Array<{ period: string; predicted: number; confidence: { lower: number; upper: number } }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: string | null;
}

@Injectable()
export class ForecastService {
  private readonly ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://forecast-service:8000';

  constructor(private prisma: PrismaService) {}

  async addHistoricalData(sku: string, quantity: number, date: string, currentUser: CurrentUserData): Promise<{ success: boolean }> {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    await this.prisma.skuHistory.create({
      data: {
        sku,
        quantity,
        date: new Date(date),
        tenant: { connect: { id: tenantId } },
      },
    });
    return { success: true };
  }

  async bulkHistoricalData(data: { sku: string; quantity: number; date: string }[], currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    return this.prisma.skuHistory.createMany({
      data: data.map(item => ({
        ...item,
        date: new Date(item.date),
        tenantId,
      })),
    });
  }

  async forecast(sku: string, periods: number = 12, currentUser: CurrentUserData): Promise<ForecastResult> {
    const historyData = await this.prisma.skuHistory.findMany({
      where: { sku },
      orderBy: { date: 'asc' },
    });

    const history = historyData.map(d => ({
      date: d.date.toISOString().split('T')[0],
      quantity: d.quantity,
    }));
    
    try {
      // Call dedicated ML microservice (Python FastAPI)
      const response = await fetch(`${this.ML_SERVICE_URL}/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          history,
          periods
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML Service failed with status ${response.status}: ${errorText}`);
      }
      
      const result = await response.json() as ForecastResult;
      return result;
    } catch (error) {
      console.error('ML Service Error:', error.message);
      throw new Error(`Forecast unavailable: ${error.message}. Please ensure the ML microservice is healthy.`);
    }
  }

  async getTrends(currentUser: CurrentUserData, sku?: string): Promise<any[]> {
    const where: any = {};
    if (sku) where.sku = sku;

    const allHistory = await this.prisma.skuHistory.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // Group by SKU
    const grouped = allHistory.reduce((acc, curr) => {
      if (!acc[curr.sku]) acc[curr.sku] = [];
      acc[curr.sku].push(curr.quantity);
      return acc;
    }, {} as Record<string, number[]>);

    return Object.entries(grouped).map(([s, values]) => ({
      sku: s,
      trend: this.calculateTrend(values),
      avgQuantity: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    }));
  }

  private calculateTrend(values: number[]): number {
    if (!values || values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    if (first === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - first) / first) * 100);
  }
}
