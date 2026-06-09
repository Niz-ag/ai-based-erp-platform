import { Injectable, BadRequestException, NotFoundException, ConflictException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';

interface CreateAccountDto {
  code: string;
  name: string;
  description?: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string;
}

interface JournalLineDto {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
  currencyId?: string;
  exchangeRate?: number;
}

interface CreateJournalEntryDto {
  date?: Date;
  description: string;
  reference?: string;
  lines: JournalLineDto[];
}

interface JournalEntryFilters {
  startDate?: Date;
  endDate?: Date;
  status?: 'DRAFT' | 'POSTED' | 'VOIDED';
  page?: number;
  limit?: number;
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  constructor(private prisma: PrismaService) {}

  // Accounts
  async findAllAccounts(currentUser: CurrentUserData, page = 1, limit = 20) {
    const p = Number(page);
    const l = Number(limit);
    const skip = (p - 1) * l;
    
    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where: { isActive: true },
        skip,
        take: l,
        orderBy: { code: 'asc' },
        include: {
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { children: true, journalLines: true } },
        },
      }),
      this.prisma.account.count({
        where: { isActive: true },
      }),
    ]);

    return {
      data: accounts,
      meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) },
    };
  }

  async findAccountById(id: string, currentUser: CurrentUserData) {
    const account = await this.prisma.account.findFirst({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
    });

    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async createAccount(dto: CreateAccountDto, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    // Check if code already exists for this tenant
    const existing = await this.prisma.account.findFirst({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Account with code ${dto.code} already exists`);
    }

    // Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    return this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  async updateAccount(id: string, dto: Partial<CreateAccountDto>, currentUser: CurrentUserData) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');

    if (dto.code && dto.code !== account.code) {
      const existing = await this.prisma.account.findFirst({
        where: { code: dto.code },
      });
      if (existing) throw new BadRequestException(`Account with code ${dto.code} already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    return this.prisma.account.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        parentId: dto.parentId,
      },
    });
  }

  async removeAccount(id: string, currentUser: CurrentUserData) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        _count: {
          select: { journalLines: true, children: true }
        }
      }
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account._count.journalLines > 0) {
      throw new ConflictException('Cannot delete account with existing journal entries');
    }

    if (account._count.children > 0) {
      throw new ConflictException('Cannot delete account with child accounts');
    }

    return this.prisma.account.delete({
      where: { id }
    });
  }

  // Journal Entries
  async getJournalEntries(
    currentUser: CurrentUserData,
    filters: JournalEntryFilters,
  ) {
    const { startDate, endDate, status, page = 1, limit = 20 } = filters;
    const p = Number(page);
    const l = Number(limit);
    const skip = (p - 1) * l;

    const where: Prisma.JournalEntryWhereInput = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (status) where.status = status;

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: l,
        orderBy: { date: 'desc' },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
              currency: { select: { id: true, code: true, symbol: true } },
            },
          },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) },
    };
  }

  async createJournalEntry(dto: CreateJournalEntryDto, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;

    // Get default currency (Base/Reporting)
    const defaultCurrency = await this.prisma.currency.findFirst({
      where: { isDefault: true, OR: [{ tenantId }, { tenantId: null }] },
    });

    if (!defaultCurrency) {
      throw new BadRequestException('Default currency (USD) not configured');
    }

    // Validate double-entry and calculate base amounts
    let totalBaseDebits = new Prisma.Decimal(0);
    let totalBaseCredits = new Prisma.Decimal(0);
    const processedLines = [];

    for (const line of dto.lines) {
      if (!line.accountId) {
        throw new BadRequestException('Each line must have an accountId');
      }

      // Verify account exists
      const account = await this.prisma.account.findFirst({
        where: { id: line.accountId },
      });

      if (!account) {
        throw new NotFoundException(`Account ${line.accountId} not found`);
      }

      let rate = new Prisma.Decimal(line.exchangeRate || 1);
      const isDefaultCurrency = !line.currencyId || line.currencyId === defaultCurrency.id;

      if (!isDefaultCurrency && !line.exchangeRate) {
        // Fetch current exchange rate to base currency
        const rateRecord = await this.prisma.exchangeRate.findFirst({
          where: {
            fromCurrencyId: line.currencyId,
            toCurrencyId: defaultCurrency.id,
            isActive: true,
          },
          orderBy: { effectiveDate: 'desc' },
        });

        if (!rateRecord) {
          const currency = await this.prisma.currency.findUnique({ where: { id: line.currencyId } });
          throw new BadRequestException(`No exchange rate found for ${currency?.code || line.currencyId} to ${defaultCurrency.code}`);
        }
        rate = rateRecord.rate;
      } else if (isDefaultCurrency) {
        rate = new Prisma.Decimal(1);
      }

      const debit = line.debit ? new Prisma.Decimal(line.debit) : new Prisma.Decimal(0);
      const credit = line.credit ? new Prisma.Decimal(line.credit) : new Prisma.Decimal(0);
      
      const baseDebit = debit.mul(rate);
      const baseCredit = credit.mul(rate);

      totalBaseDebits = totalBaseDebits.plus(baseDebit);
      totalBaseCredits = totalBaseCredits.plus(baseCredit);

      processedLines.push({
        ...line,
        debit: line.debit ? debit : null,
        credit: line.credit ? credit : null,
        baseDebit,
        baseCredit,
        exchangeRate: rate,
      });
    }

    // Validate debits = credits in base currency
    if (!totalBaseDebits.equals(totalBaseCredits)) {
      throw new BadRequestException(
        `Double-entry validation failed: total debits (${totalBaseDebits}) must equal total credits (${totalBaseCredits}) in ${defaultCurrency.code}`,
      );
    }

    // Create journal entry with lines in transaction
    return this.prisma.$transaction(async (tx) => {
      // Generate entry number ATOMICALLY using the Sequence table
      const sequence = await tx.sequence.upsert({
        where: { tenantId_name: { tenantId, name: 'journal_entry' } },
        update: { value: { increment: 1 } },
        create: { name: 'journal_entry', value: 1, tenant: { connect: { id: tenantId } } },
      });
      
      const entryNumber = `JE-${String(sequence.value).padStart(6, '0')}`;

      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: dto.date || new Date(),
          description: dto.description,
          reference: dto.reference,
          status: 'DRAFT',
          createdBy: { connect: { id: currentUser.id } },
          tenant: { connect: { id: tenantId } },
          lines: {
            create: processedLines.map((line) => ({
              account: { connect: { id: line.accountId } },
              debit: line.debit,
              credit: line.credit,
              baseDebit: line.baseDebit,
              baseCredit: line.baseCredit,
              description: line.description,
              currency: line.currencyId ? { connect: { id: line.currencyId } } : undefined,
              exchangeRate: line.exchangeRate,
              tenant: { connect: { id: tenantId } },
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return entry;
    });
  }

  async postJournalEntry(id: string, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!entry) throw new NotFoundException('Journal entry not found');
      if (entry.status === 'POSTED') throw new BadRequestException('Entry already posted');

      // Update balances for each account involved
      for (const line of entry.lines) {
        const account = await tx.account.findUnique({ where: { id: line.accountId } });
        if (!account) throw new NotFoundException(`Account ${line.accountId} not found`);

        // Logic for debit/credit depends on account type
        // Assets/Expenses increase with Debit, decrease with Credit
        // Liabilities/Equity/Revenue increase with Credit, decrease with Debit
        let balanceAdjustment = new Prisma.Decimal(0);
        
        const isNormalDebit = account.type === 'ASSET' || account.type === 'EXPENSE';
        
        if (line.baseDebit) {
          balanceAdjustment = isNormalDebit ? balanceAdjustment.plus(line.baseDebit) : balanceAdjustment.minus(line.baseDebit);
        }
        if (line.baseCredit) {
          balanceAdjustment = isNormalDebit ? balanceAdjustment.minus(line.baseCredit) : balanceAdjustment.plus(line.baseCredit);
        }

        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: balanceAdjustment } },
        });
      }

      return tx.journalEntry.update({
        where: { id },
        data: { status: 'POSTED' },
        include: { lines: { include: { account: true } } },
      });
    });
  }

  async getProfitAndLoss(currentUser: CurrentUserData, startDate: Date, endDate: Date) {
    // Validate dates
    const start = (startDate && !isNaN(startDate.getTime())) ? startDate : new Date(new Date().getFullYear(), 0, 1);
    const end = (endDate && !isNaN(endDate.getTime())) ? endDate : new Date();

    const accounts = await this.prisma.account.findMany({
      where: {
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              date: { gte: start, lte: end },
            },
          },
        },
      },
    });

    const report = {
      revenue: [] as any[],
      expense: [] as any[],
      totalRevenue: new Prisma.Decimal(0),
      totalExpense: new Prisma.Decimal(0),
      netProfit: new Prisma.Decimal(0),
    };

    for (const account of accounts) {
      let balance = new Prisma.Decimal(0);
      for (const line of account.journalLines) {
        if (account.type === 'REVENUE') {
          // Revenue increases with Credit
          if (line.baseCredit) balance = balance.plus(line.baseCredit);
          if (line.baseDebit) balance = balance.minus(line.baseDebit);
        } else {
          // Expense increases with Debit
          if (line.baseDebit) balance = balance.plus(line.baseDebit);
          if (line.baseCredit) balance = balance.minus(line.baseCredit);
        }
      }

      // Only include accounts with activity or non-zero balance for a cleaner report
      if (balance.isZero() && account.journalLines.length === 0) continue;

      const item = {
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance,
      };

      if (account.type === 'REVENUE') {
        report.revenue.push(item);
        report.totalRevenue = report.totalRevenue.plus(balance);
      } else {
        report.expense.push(item);
        report.totalExpense = report.totalExpense.plus(balance);
      }
    }

    report.netProfit = report.totalRevenue.minus(report.totalExpense);
    return report;
  }

  async getBalanceSheet(currentUser: CurrentUserData, date: Date) {
    const asOfDate = (date && !isNaN(date.getTime())) ? date : new Date();

    // 1. Fetch all accounts
    const accounts = await this.prisma.account.findMany();

    // 2. Fetch summed journal lines up to asOfDate from POSTED entries
    // Reconstructs balance by summing historical baseDebits and baseCredits
    const journalSummary = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          status: 'POSTED',
          date: { lte: asOfDate },
        },
      },
      _sum: {
        baseDebit: true,
        baseCredit: true,
      },
    });

    // Create a map for quick lookup of the summed debits/credits per account
    const balanceMap = new Map(
      journalSummary.map((s) => [
        s.accountId,
        {
          debit: s._sum.baseDebit || new Prisma.Decimal(0),
          credit: s._sum.baseCredit || new Prisma.Decimal(0),
        },
      ]),
    );

    const report = {
      assets: [] as any[],
      liabilities: [] as any[],
      equity: [] as any[],
      totalAssets: new Prisma.Decimal(0),
      totalLiabilities: new Prisma.Decimal(0),
      totalEquity: new Prisma.Decimal(0),
      retainedEarnings: new Prisma.Decimal(0),
    };

    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const account of accounts) {
      const summary = balanceMap.get(account.id) || {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };

      let balance = new Prisma.Decimal(0);
      
      // Calculate historical balance based on account type
      // Assets/Expenses increase with Debit, decrease with Credit
      // Liabilities/Equity/Revenue increase with Credit, decrease with Debit
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        balance = summary.debit.minus(summary.credit);
      } else {
        balance = summary.credit.minus(summary.debit);
      }

      const item = {
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance,
      };

      switch (account.type) {
        case 'ASSET':
          report.assets.push(item);
          report.totalAssets = report.totalAssets.plus(balance);
          break;
        case 'LIABILITY':
          report.liabilities.push(item);
          report.totalLiabilities = report.totalLiabilities.plus(balance);
          break;
        case 'EQUITY':
          report.equity.push(item);
          report.totalEquity = report.totalEquity.plus(balance);
          break;
        case 'REVENUE':
          totalRevenue = totalRevenue.plus(balance);
          break;
        case 'EXPENSE':
          totalExpense = totalExpense.plus(balance);
          break;
      }
    }

    // Dynamic Retained Earnings = Cumulative Revenue - Cumulative Expense as of the date
    report.retainedEarnings = totalRevenue.minus(totalExpense);
    
    // Add Retained Earnings to Equity section for the balance sheet to balance
    report.equity.push({
      id: 'retained-earnings',
      code: '3999',
      name: 'Retained Earnings (Net Income)',
      balance: report.retainedEarnings,
    });
    
    report.totalEquity = report.totalEquity.plus(report.retainedEarnings);

    return report;
  }

  // Currencies
  async findAllCurrencies(currentUser: CurrentUserData) {
    return this.prisma.currency.findMany({
      where: {
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async createCurrency(data: any, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    return this.prisma.currency.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async updateCurrency(id: string, dto: { code?: string, name?: string, symbol?: string, isActive?: boolean }, currentUser: CurrentUserData) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException('Currency not found');

    return this.prisma.currency.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCurrency(id: string, currentUser: CurrentUserData) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException('Currency not found');
    if (currency.isDefault) throw new Error('Cannot delete default currency');

    return this.prisma.currency.update({
      where: { id },
      data: { isActive: false },
    });
  }

  @Inject(RedisService) private redis: RedisService;

  // Exchange Rates
  async findAllExchangeRates(currentUser: CurrentUserData) {
    const cacheKey = `fx_rates:${currentUser.tenantId || 'global'}`;
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      this.logger.error(`Redis error fetching FX rates: ${e.message}`);
    }

    const rates = await this.prisma.exchangeRate.findMany({
      where: {
        isActive: true,
      },
      orderBy: { effectiveDate: 'desc' },
      include: {
        fromCurrency: { select: { id: true, code: true, name: true } },
        toCurrency: { select: { id: true, code: true, name: true } },
      },
    });

    try {
      // Cache for 1 hour
      await this.redis.set(cacheKey, JSON.stringify(rates), 3600);
    } catch (e) {
      this.logger.error(`Failed to cache FX rates: ${e.message}`);
    }

    return rates;
  }
}