import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { BankRecService } from './bank-rec.service';
import { FileInterceptor } from '@nestjs/platform-express';
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
  constructor(
    private financeService: FinanceService,
    private bankRecService: BankRecService
  ) {}

  // Bank Reconciliation
  @Post('bank-reconciliation/process')
  @Roles('superadmin', 'admin', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  processBankStatement(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    const csvContent = file.buffer.toString('utf-8');
    return this.bankRecService.processCsv(csvContent, currentUser);
  }

  @Post('bank-reconciliation/reconcile')
  @Roles('superadmin', 'admin', 'manager')
  reconcile(
    @Body() dto: { journalEntryId: string, statementLine: any },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.bankRecService.reconcile(dto.journalEntryId, dto.statementLine, currentUser);
  }

  @Post('bank-reconciliation/manual')
  @Roles('superadmin', 'admin', 'manager')
  createManualEntry(
    @Body() dto: { statementLine: any, bankAccountId: string, otherAccountId: string },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.bankRecService.createManualEntry(dto, currentUser);
  }

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

  @Put('accounts/:id')
  @Roles('superadmin', 'admin', 'manager')
  updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateAccountDto>,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.updateAccount(id, dto, currentUser);
  }

  @Delete('accounts/:id')
  @Roles('superadmin', 'admin', 'manager')
  removeAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.removeAccount(id, currentUser);
  }

  // Journal Entries endpoints
  @Get('journal-entries')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getJournalEntries(
    @CurrentUser() currentUser: CurrentUserData,
    @Query() query: JournalEntryFilters,
  ) {
    return this.financeService.getJournalEntries(currentUser, {
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

  @Get('reports/balance-sheet')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getBalanceSheet(
    @Query('date') date: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.getBalanceSheet(
      currentUser,
      date ? new Date(date) : new Date(),
    );
  }

  // Currencies endpoints
  @Get('currencies')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllCurrencies(@CurrentUser() currentUser: CurrentUserData) {
    return this.financeService.findAllCurrencies(currentUser);
  }

  @Post('currencies')
  @Roles('superadmin', 'admin', 'manager')
  createCurrency(
    @Body() dto: { code: string, name: string, symbol?: string, exchangeRate?: number },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.createCurrency(dto, currentUser);
  }

  @Put('currencies/:id')
  @Roles('superadmin', 'admin', 'manager')
  updateCurrency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { code?: string, name?: string, symbol?: string, isActive?: boolean },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.updateCurrency(id, dto, currentUser);
  }

  @Delete('currencies/:id')
  @Roles('superadmin', 'admin', 'manager')
  deleteCurrency(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.financeService.deleteCurrency(id, currentUser);
  }

  // Exchange Rates endpoints
  @Get('exchange-rates')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllExchangeRates(@CurrentUser() currentUser: CurrentUserData) {
    return this.financeService.findAllExchangeRates(currentUser);
  }
}