import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ForecastService } from './forecast.service';

export class ForecastDemandDto {
  sku!: string;
  periods?: number;
}

class HistoricalDataDto {
  sku!: string;
  quantity!: number;
  date!: string;
}

@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Post('demand')
  forecastDemand(@Body() dto: ForecastDemandDto) {
    return this.forecastService.forecast(dto.sku, dto.periods || 12);
  }

  @Post('historical')
  addHistoricalData(@Body() dto: HistoricalDataDto) {
    return this.forecastService.addHistoricalData(dto.sku, dto.quantity, dto.date);
  }

  @Get('demand/:sku')
  getForecast(@Param('sku') sku: string, @Query('periods') periods = 12) {
    return this.forecastService.forecast(sku, Number(periods));
  }

  @Get('trends')
  getTrends(@Query('sku') sku?: string) {
    return this.forecastService.getTrends(sku);
  }
}