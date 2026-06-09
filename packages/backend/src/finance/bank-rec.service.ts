import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

@Injectable()
export class BankRecService {
  constructor(private prisma: PrismaService) {}

  async processCsv(csvContent: string, currentUser: CurrentUserData) {
    const lines = csvContent.split('\n');
    const results = [];

    // Skip header if it exists (Date, Desc, Amount)
    const startIndex = lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('desc') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing: handling potential quotes would be better but keeping it simple as requested
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''));
      
      if (parts.length < 3) continue;

      const [dateStr, description, amountStr] = parts;
      const date = new Date(dateStr);
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));

      if (isNaN(date.getTime()) || isNaN(amount)) continue;

      // Normalize date for comparison (start and end of day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Logic: Attempt to 'Auto-match' lines against existing 'JournalEntry' records with the same date/amount.
      // We look for journal entries on the same day that have a line with the same absolute amount.
      const matches = await this.prisma.journalEntry.findMany({
        where: {
          tenantId: currentUser.tenantId,
          isReconciled: false, // Only match unreconciled entries
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          lines: {
            some: {
              OR: [
                { debit: Math.abs(amount) },
                { credit: Math.abs(amount) }
              ]
            }
          }
        },
        include: {
          lines: {
            include: {
              account: true
            }
          }
        }
      });

      results.push({
        statementLine: {
          date: dateStr,
          description,
          amount
        },
        matchedEntries: matches.map(entry => ({
          id: entry.id,
          entryNumber: entry.entryNumber,
          date: entry.date,
          description: entry.description,
          status: entry.status,
          totalAmount: entry.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0),
          lines: entry.lines
        }))
      });
    }

    return results;
  }

  async reconcile(journalEntryId: string, statementLine: any, currentUser: CurrentUserData) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create BankStatementLine record
      const bankLine = await tx.bankStatementLine.create({
        data: {
          date: new Date(statementLine.date),
          description: statementLine.description,
          amount: statementLine.amount,
          tenantId: currentUser.tenantId,
          journalEntryId: journalEntryId,
        },
      });

      // 2. Mark JournalEntry as reconciled
      const updatedEntry = await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: {
          isReconciled: true,
        },
      });

      return {
        bankStatementLine: bankLine,
        journalEntry: updatedEntry,
      };
    });
  }

  async createManualEntry(dto: { statementLine: any, bankAccountId: string, otherAccountId: string }, currentUser: CurrentUserData) {
    const { statementLine, bankAccountId, otherAccountId } = dto;
    const amount = new Prisma.Decimal(statementLine.amount);
    const tenantId = currentUser.tenantId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate entry number
      const sequence = await tx.sequence.upsert({
        where: { tenantId_name: { tenantId, name: 'journal_entry' } },
        update: { value: { increment: 1 } },
        create: { name: 'journal_entry', value: 1, tenant: { connect: { id: tenantId } } },
      });
      const entryNumber = `JE-BR-${String(sequence.value).padStart(6, '0')}`;

      // 2. Create Journal Entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(statementLine.date),
          description: `Bank Reconciliation: ${statementLine.description}`,
          status: 'POSTED', // Auto-post for reconciliation
          isReconciled: true,
          tenant: { connect: { id: tenantId } },
          createdBy: { connect: { id: currentUser.id } },
          lines: {
            create: [
              {
                // Bank Account side
                account: { connect: { id: bankAccountId } },
                debit: amount.gt(0) ? amount : null,
                credit: amount.lt(0) ? amount.abs() : null,
                baseDebit: amount.gt(0) ? amount : null,
                baseCredit: amount.lt(0) ? amount.abs() : null,
                tenant: { connect: { id: tenantId } },
              },
              {
                // Other side
                account: { connect: { id: otherAccountId } },
                debit: amount.lt(0) ? amount.abs() : null,
                credit: amount.gt(0) ? amount : null,
                baseDebit: amount.lt(0) ? amount.abs() : null,
                baseCredit: amount.gt(0) ? amount : null,
                tenant: { connect: { id: tenantId } },
              }
            ]
          }
        }
      });

      // 3. Update account balances (since we auto-posted)
      const accounts = [
        { id: bankAccountId, amount: amount },
        { id: otherAccountId, amount: amount.neg() }
      ];

      for (const acc of accounts) {
        const account = await tx.account.findUnique({ where: { id: acc.id } });
        if (!account) continue;

        const isNormalDebit = account.type === 'ASSET' || account.type === 'EXPENSE';
        
        // If amount is positive, it's a Debit. If negative, it's a Credit.
        // For normal-debit accounts (Asset/Expense), Debit increases and Credit decreases balance.
        // For normal-credit accounts (Liability/Equity/Revenue), Credit increases and Debit decreases balance.
        const balanceAdjustment = isNormalDebit ? acc.amount : acc.amount.neg();

        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: balanceAdjustment } },
        });
      }

      // 4. Create BankStatementLine and link it
      const bankLine = await tx.bankStatementLine.create({
        data: {
          date: new Date(statementLine.date),
          description: statementLine.description,
          amount: amount,
          tenantId: tenantId,
          journalEntryId: entry.id,
        },
      });

      return {
        journalEntry: entry,
        bankStatementLine: bankLine,
      };
    });
  }
}
