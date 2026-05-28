import { Controller, Get, Post, Put, Body, Query, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface PaginationQuery {
  page?: number;
  limit?: number;
}

interface JournalEntryFilters extends PaginationQuery {
  startDate?: Date;
  endDate?: Date;
  status?: 'DRAFT' | 'POSTED' | 'VOIDED';
}

interface ReportQuery {
  startDate: string;
  endDate: string;
}

// Account DTOs
interface CreateAccountDto {
  code: string;
  name: string;
  description?: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string;
}

// Journal Line DTO
interface JournalLineDto {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
  currencyId?: string;
  exchangeRate?: number;
}

// Journal Entry DTO
interface CreateJournalEntryDto {
  date?: Date;
  description: string;
  lines: JournalLineDto[];
}

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  // Accounts endpoints
  @Get('accounts')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllAccounts(
    @CurrentUser() currentUser: CurrentUserData,
    @Query() query: PaginationQuery,
  ) {
    return this.financeService.findAllAccounts(
      currentUser,
      query.page || 1,
      query.limit || 20,
    );
  }

  @Post('accounts')
  @Roles('superadmin', 'admin', 'manager')
  createAccount(
    @Body() dto: CreateAccountDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.createAccount(dto, currentUser);
  }

  // Journal Entries endpoints
  @Get('journal-entries')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllJournalEntries(
    @CurrentUser() currentUser: CurrentUserData,
    @Query() query: JournalEntryFilters,
  ) {
    return this.financeService.findAllJournalEntries(currentUser, {
      page: query.page || 1,
      limit: query.limit || 20,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
    });
  }

  @Post('journal-entries')
  @Roles('superadmin', 'admin', 'manager')
  createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.createJournalEntry(dto, currentUser);
  }

  @Put('journal-entries/:id/post')
  @Roles('superadmin', 'admin', 'manager')
  postJournalEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.postJournalEntry(id, currentUser);
  }

  // Reports
  @Get('reports/profit-loss')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getProfitAndLoss(
    @Query() query: ReportQuery,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.getProfitAndLoss(
      currentUser,
      new Date(query.startDate),
      new Date(query.endDate),
    );
  }

  // Currencies endpoints
  @Get('currencies')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllCurrencies(@CurrentUser() currentUser: CurrentUserData) {
    return this.financeService.findAllCurrencies(currentUser);
  }

  // Exchange Rates endpoints
  @Get('exchange-rates')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllExchangeRates(@CurrentUser() currentUser: CurrentUserData) {
    return this.financeService.findAllExchangeRates(currentUser);
  }
}