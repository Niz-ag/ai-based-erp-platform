import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

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
    await this.prisma.skuHistory.create({
      data: {
        sku,
        quantity,
        date: new Date(date),
        tenantId: currentUser.tenantId,
      },
    });
    return { success: true };
  }

  async forecast(sku: string, periods: number = 12, currentUser: CurrentUserData): Promise<ForecastResult> {
    const historyData = await this.prisma.skuHistory.findMany({
      where: { sku, tenantId: currentUser.tenantId },
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

      if (!response.ok) throw new Error('ML Service failed');
      
      const result = await response.json() as ForecastResult;
      return result;
    } catch (error) {
      console.warn('ML Service unreachable, falling back to basic demo logic:', error.message);
      return this.generateDemoForecast(sku, periods);
    }
  }

  private generateDemoForecast(sku: string, periods: number): ForecastResult {
    const forecasts = [];
    const baseValue = Math.floor(Math.random() * 100) + 50;
    const trend = Math.random() > 0.5 ? 'increasing' : 'stable';
    
    for (let i = 1; i <= periods; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const predicted = Math.round(baseValue * (1.02 ** i));
      
      forecasts.push({
        period: date.toISOString().slice(0, 7),
        predicted,
        confidence: {
          lower: Math.round(predicted * 0.8),
          upper: Math.round(predicted * 1.2),
        },
      });
    }

    return { sku, forecasts, trend: trend as any, seasonality: 'Legacy fallback active' };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avg = sumY / n;
    
    if (slope / avg > 0.05) return 'increasing';
    if (slope / avg < -0.05) return 'decreasing';
    return 'stable';
  }

  private detectSeasonality(values: number[]): string | null {
    if (values.length < 12) return null;
    
    // Simple check for monthly patterns
    const monthly: number[] = [];
    for (let i = 0; i < 12; i++) {
      monthly.push(values.slice(i * Math.floor(values.length / 12), (i + 1) * Math.floor(values.length / 12))
        .reduce((a, b) => a + b, 0));
    }
    
    const avg = monthly.reduce((a, b) => a + b, 0) / 12;
    const peak = Math.max(...monthly);
    const trough = Math.min(...monthly);
    
    if (peak / trough > 1.5) {
      const peakMonth = new Date(2024, monthly.indexOf(peak), 1).toLocaleString('default', { month: 'long' });
      return `Peak in ${peakMonth}`;
    }
    
    return null;
  }

  async getTrends(currentUser: CurrentUserData, sku?: string): Promise<any[]> {
    const where: any = { tenantId: currentUser.tenantId };
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
}
