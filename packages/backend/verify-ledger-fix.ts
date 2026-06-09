import { PrismaClient, AccountType } from '@prisma/client';
import { FinanceService } from './src/finance/finance.service';
import { BankRecService } from './src/finance/bank-rec.service';
import { PrismaService } from './src/common/prisma.service';
import { CurrentUserData } from './src/common/decorators/current-user.decorator';
import { tenantContextStorage } from './src/common/tenant-context';

const prisma = new PrismaClient();

async function main() {
  console.log('--- VERIFYING FINANCIAL & LEDGER INTEGRITY ---');

  const prismaService = new PrismaService();
  const financeService = new FinanceService(prismaService);
  const bankRecService = new BankRecService(prismaService);

  // 1. Setup Tenant and Context
  let tenant = await prisma.tenant.findFirst({ where: { name: 'Ledger Test Tenant' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Ledger Test Tenant' }
    });
  }

  // Ensure default currency
  let usd = await prisma.currency.findFirst({ where: { code: 'USD' } });
  if (!usd) {
    usd = await prisma.currency.create({
      data: { code: 'USD', name: 'US Dollar', symbol: '$', isDefault: true }
    });
  }

  const mockUser: CurrentUserData = {
    id: 'test-user-id',
    email: 'test@example.com',
    tenantId: tenant.id,
    role: 'admin'
  };

  // Set tenant context
  await tenantContextStorage.run({ tenantId: tenant.id }, async () => {
    
    // 2. Test: Historical reports include inactive accounts
    console.log('\nTesting Inactive Accounts in Reports...');
    
    // Create an inactive account with some history
    const inactiveAccount = await prisma.account.create({
      data: {
        code: '9999-INACTIVE',
        name: 'Inactive Account with Balance',
        type: 'REVENUE',
        isActive: false,
        tenantId: tenant.id,
      }
    });

    // Create a posted journal entry for this account
    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber: 'JE-INACTIVE-' + Date.now(),
        description: 'Initial balance for inactive',
        status: 'POSTED',
        tenantId: tenant.id,
        createdById: 'test-user-id', // Assuming it exists or ignoring FK for now if not strictly enforced in this test
        lines: {
          create: [
            {
              accountId: inactiveAccount.id,
              baseCredit: 100,
              tenantId: tenant.id,
            },
            {
              accountId: inactiveAccount.id, // Just to balance for now, normally it would be another account
              baseDebit: 100,
              tenantId: tenant.id,
              // Wait, I need a real balancing account or it will fail if I used the service.
              // But here I'm using prisma directly to bypass validation for speed.
            }
          ]
        }
      }
    });

    // Actually let's create a balancing account
    const cashAcc = await prisma.account.create({
        data: { code: '1000-CASH-' + Date.now(), name: 'Cash', type: 'ASSET', tenantId: tenant.id }
    });
    
    await prisma.journalLine.create({
        data: {
            journalEntryId: entry.id,
            accountId: cashAcc.id,
            baseDebit: 100,
            tenantId: tenant.id,
        }
    });

    const pnl = await financeService.getProfitAndLoss(mockUser, new Date(2000, 0, 1), new Date(2100, 0, 1));
    const foundInPnl = pnl.revenue.find(a => a.id === inactiveAccount.id);
    console.log(`- Inactive account found in P&L: ${!!foundInPnl}`);

    const bs = await financeService.getBalanceSheet(mockUser, new Date(2100, 0, 1));
    // Since it's revenue, it affects Retained Earnings.
    // Let's check if it was used in calculation.
    // getBalanceSheet sums all accounts.
    // In our case, cash (100) and inactive revenue (100 credit -> 100 balance).
    console.log(`- Total Assets: ${bs.totalAssets}`);
    console.log(`- Retained Earnings: ${bs.retainedEarnings}`);

    // 3. Test: Multi-currency consistency in P&L
    console.log('\nTesting Multi-currency consistency in P&L...');
    const eur = await prisma.currency.upsert({
        where: { code: 'EUR' },
        update: { isActive: true },
        create: { code: 'EUR', name: 'Euro', symbol: '€', isDefault: false }
    });

    const revenueAccount = await prisma.account.create({
        data: { code: '4001-REV-' + Date.now(), name: 'EUR Revenue', type: 'REVENUE', tenantId: tenant.id }
    });

    // 100 EUR @ 1.1 = 110 USD
    await prisma.journalEntry.create({
        data: {
            entryNumber: 'JE-EUR-' + Date.now(),
            description: 'EUR Revenue',
            status: 'POSTED',
            tenantId: tenant.id,
            createdById: 'test-user-id',
            lines: {
                create: [
                    {
                        accountId: revenueAccount.id,
                        credit: 100,
                        baseCredit: 110,
                        currencyId: eur.id,
                        exchangeRate: 1.1,
                        tenantId: tenant.id,
                    },
                    {
                        accountId: cashAcc.id,
                        debit: 110,
                        baseDebit: 110,
                        tenantId: tenant.id,
                    }
                ]
            }
        }
    });

    const pnl2 = await financeService.getProfitAndLoss(mockUser, new Date(2000, 0, 1), new Date(2100, 0, 1));
    const eurRev = pnl2.revenue.find(a => a.id === revenueAccount.id);
    console.log(`- EUR Revenue Balance (Expected 110): ${eurRev?.balance}`);

    // 4. Test: createManualEntry balance update
    console.log('\nTesting createManualEntry balance update...');
    
    const bankAcc = await prisma.account.create({
        data: { code: '1001-BANK-' + Date.now(), name: 'Bank', type: 'ASSET', tenantId: tenant.id }
    });
    const liabilityAcc = await prisma.account.create({
        data: { code: '2000-LOAN-' + Date.now(), name: 'Loan', type: 'LIABILITY', tenantId: tenant.id }
    });

    // Deposit of $500 (Debit Bank, Credit Loan)
    await bankRecService.createManualEntry({
        statementLine: { date: new Date(), description: 'Loan Deposit', amount: 500 },
        bankAccountId: bankAcc.id,
        otherAccountId: liabilityAcc.id,
    }, mockUser);

    const updatedBank = await prisma.account.findUnique({ where: { id: bankAcc.id } });
    const updatedLoan = await prisma.account.findUnique({ where: { id: liabilityAcc.id } });

    console.log(`- Bank Balance (Expected 500): ${updatedBank?.balance}`);
    console.log(`- Loan Balance (Expected 500): ${updatedLoan?.balance}`);

    // Payment of $200 (Credit Bank, Debit Loan)
    await bankRecService.createManualEntry({
        statementLine: { date: new Date(), description: 'Loan Payment', amount: -200 },
        bankAccountId: bankAcc.id,
        otherAccountId: liabilityAcc.id,
    }, mockUser);

    const finalBank = await prisma.account.findUnique({ where: { id: bankAcc.id } });
    const finalLoan = await prisma.account.findUnique({ where: { id: liabilityAcc.id } });

    console.log(`- Final Bank Balance (Expected 300): ${finalBank?.balance}`);
    console.log(`- Final Loan Balance (Expected 300): ${finalLoan?.balance}`);

    console.log('\n--- VERIFICATION COMPLETE ---');
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
