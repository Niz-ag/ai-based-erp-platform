import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

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
  constructor(private prisma: PrismaService) {}

  // Accounts
  async findAllAccounts(currentUser: CurrentUserData, page = 1, limit = 20) {
    const p = Number(page);
    const l = Number(limit);
    const skip = (p - 1) * l;
    
    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where: { tenantId: currentUser.tenantId, isActive: true },
        skip,
        take: l,
        orderBy: { code: 'asc' },
        include: {
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { children: true, journalLines: true } },
        },
      }),
      this.prisma.account.count({
        where: { tenantId: currentUser.tenantId, isActive: true },
      }),
    ]);

    return {
      data: accounts,
      meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) },
    };
  }

  async findAccountById(id: string, currentUser: CurrentUserData) {
    const account = await this.prisma.account.findFirst({
      where: { id, tenantId: currentUser.tenantId },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
    });

    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async createAccount(dto: CreateAccountDto, currentUser: CurrentUserData) {
    // Check if code already exists for this tenant
    const existing = await this.prisma.account.findUnique({
      where: { code_tenantId: { code: dto.code, tenantId: currentUser.tenantId } },
    });

    if (existing) {
      throw new BadRequestException(`Account with code ${dto.code} already exists`);
    }

    // Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, tenantId: currentUser.tenantId },
      });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    return this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        tenant: { connect: { id: currentUser.tenantId } },
        parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
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

    const where: Prisma.JournalEntryWhereInput = {
      tenantId: currentUser.tenantId,
    };

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
    let totalDebits = 0;
    let totalCredits = 0;

    for (const line of dto.lines) {
      if (!line.accountId) {
        throw new BadRequestException('Each line must have an accountId');
      }

      // Verify account exists and belongs to tenant
      const account = await this.prisma.account.findFirst({
        where: { id: line.accountId, tenantId: currentUser.tenantId },
      });

      if (!account) {
        throw new NotFoundException(`Account ${line.accountId} not found`);
      }

      if (line.debit) totalDebits += Number(line.debit);
      if (line.credit) totalCredits += Number(line.credit);
    }

    // Validate debits = credits
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new BadRequestException(
        `Double-entry validation failed: debits (${totalDebits}) must equal credits (${totalCredits})`,
      );
    }

    // Generate entry number
    const entryCount = await this.prisma.journalEntry.count({
      where: { tenantId: currentUser.tenantId },
    });
    const entryNumber = `JE-${String(entryCount + 1).padStart(6, '0')}`;

    // Create journal entry with lines in transaction
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: dto.date || new Date(),
          description: dto.description,
          status: 'DRAFT',
          tenant: { connect: { id: currentUser.tenantId } },
          createdBy: { connect: { id: currentUser.id } },
          lines: {
            create: dto.lines.map((line) => ({
              account: { connect: { id: line.accountId } },
              debit: line.debit ? new Prisma.Decimal(line.debit) : null,
              credit: line.credit ? new Prisma.Decimal(line.credit) : null,
              description: line.description,
              currency: line.currencyId ? { connect: { id: line.currencyId } } : undefined,
              exchangeRate: line.exchangeRate ? new Prisma.Decimal(line.exchangeRate) : new Prisma.Decimal(1),
              tenant: { connect: { id: currentUser.tenantId } },
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

  // Currencies
  async findAllCurrencies(currentUser: CurrentUserData) {
    return this.prisma.currency.findMany({
      where: {
        OR: [
          { tenantId: null },
          { tenantId: currentUser.tenantId },
        ],
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  // Exchange Rates
  async findAllExchangeRates(currentUser: CurrentUserData) {
    return this.prisma.exchangeRate.findMany({
      where: {
        OR: [
          { tenantId: null },
          { tenantId: currentUser.tenantId },
        ],
        isActive: true,
      },
      orderBy: { effectiveDate: 'desc' },
      include: {
        fromCurrency: { select: { id: true, code: true, name: true } },
        toCurrency: { select: { id: true, code: true, name: true } },
      },
    });
  }
}