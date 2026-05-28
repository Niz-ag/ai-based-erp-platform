import { Injectable, BadRequestException, NotFoundException, Inject, Logger } from '@nestjs/common';
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

  // Journal Entries
  async findAllJournalEntries(
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
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
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
    // Validate double-entry: debits must equal credits
    let totalDebits = new Prisma.Decimal(0);
    let totalCredits = new Prisma.Decimal(0);

    for (const line of dto.lines) {
      if (!line.accountId) {
        throw new BadRequestException('Each line must have an accountId');
      }

      // Verify account exists and belongs to tenant
      const account = await this.prisma.account.findFirst({
        where: { id: line.accountId },
      });

      if (!account) {
        throw new NotFoundException(`Account ${line.accountId} not found`);
      }

      if (line.debit) totalDebits = totalDebits.plus(new Prisma.Decimal(line.debit));
      if (line.credit) totalCredits = totalCredits.plus(new Prisma.Decimal(line.credit));
    }

    // Validate debits = credits
    if (!totalDebits.equals(totalCredits)) {
      throw new BadRequestException(
        `Double-entry validation failed: debits (${totalDebits}) must equal credits (${totalCredits})`,
      );
    }

    // Create journal entry with lines in transaction
    const tenantId = tenantContextStorage.getStore()?.tenantId;
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
          status: 'DRAFT',
          createdBy: { connect: { id: currentUser.id } },
          tenant: { connect: { id: tenantId } },
          lines: {
            create: dto.lines.map((line) => ({
              account: { connect: { id: line.accountId } },
              debit: line.debit ? new Prisma.Decimal(line.debit) : null,
              credit: line.credit ? new Prisma.Decimal(line.credit) : null,
              description: line.description,
              currency: line.currencyId ? { connect: { id: line.currencyId } } : undefined,
              exchangeRate: line.exchangeRate ? new Prisma.Decimal(line.exchangeRate) : new Prisma.Decimal(1),
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
        
        if (line.debit) {
          balanceAdjustment = isNormalDebit ? balanceAdjustment.plus(line.debit) : balanceAdjustment.minus(line.debit);
        }
        if (line.credit) {
          balanceAdjustment = isNormalDebit ? balanceAdjustment.minus(line.credit) : balanceAdjustment.plus(line.credit);
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
    const accounts = await this.prisma.account.findMany({
      where: {
        isActive: true,
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              date: { gte: startDate, lte: endDate },
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
          if (line.credit) balance = balance.plus(line.credit);
          if (line.debit) balance = balance.minus(line.debit);
        } else {
          // Expense increases with Debit
          if (line.debit) balance = balance.plus(line.debit);
          if (line.credit) balance = balance.minus(line.credit);
        }
      }

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

  // Currencies
  async findAllCurrencies(currentUser: CurrentUserData) {
    return this.prisma.currency.findMany({
      where: {
        isActive: true,
      },
      orderBy: { code: 'asc' },
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
    } catch (e) {}

    return rates;
  }
}