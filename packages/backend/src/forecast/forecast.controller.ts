import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

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
@UseGuards(JwtAuthGuard)
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Post('demand')
  forecastDemand(@Body() dto: ForecastDemandDto, @CurrentUser() user: CurrentUserData) {
    return this.forecastService.forecast(dto.sku, dto.periods || 12, user);
  }

  @Post('historical')
  addHistoricalData(@Body() dto: HistoricalDataDto, @CurrentUser() user: CurrentUserData) {
    return this.forecastService.addHistoricalData(dto.sku, dto.quantity, dto.date, user);
  }

  @Get('demand/:sku')
  getForecast(@Param('sku') sku: string, @Query('periods') periods = 12, @CurrentUser() user: CurrentUserData) {
    return this.forecastService.forecast(sku, Number(periods), user);
  }

  @Get('trends')
  getTrends(@CurrentUser() user: CurrentUserData, @Query('sku') sku?: string) {
    return this.forecastService.getTrends(user, sku);
  }
}