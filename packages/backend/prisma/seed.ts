import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Grand Seed...');

  // 1. ROLES
  console.log('Setting up roles...');
  const roles = [
    { name: 'SuperAdmin', permissions: ['*'] },
    { name: 'Admin', permissions: ['all'] },
    { name: 'Manager', permissions: ['create', 'read', 'update'] },
    { name: 'User', permissions: ['read', 'own_update'] },
    { name: 'Viewer', permissions: ['read'] },
  ];

  const roleMap: Record<string, any> = {};
  for (const r of roles) {
    roleMap[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: { permissions: JSON.stringify(r.permissions) },
      create: { name: r.name, permissions: JSON.stringify(r.permissions) },
    });
  }

  // 2. TENANT
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'amdox.com' },
    update: {},
    create: { name: 'Amdox Technologies', domain: 'amdox.com', isActive: true },
  });

  // 3. CURRENCY
  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', isDefault: true },
  });

  // 4. SEQUENCES
  const sequences = ['audit_log', 'journal_entry', 'purchase_order', 'sales_order', 'employee_code'];
  for (const seq of sequences) {
    await prisma.sequence.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: seq } },
      update: {},
      create: { tenantId: tenant.id, name: seq, value: 100 },
    });
  }

  // 5. ADMIN USER
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@amdox.com', tenantId: tenant.id } },
    update: { isActive: true, roleId: roleMap['Admin'].id },
    create: {
      email: 'admin@amdox.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      tenantId: tenant.id,
      roleId: roleMap['Admin'].id,
      isActive: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP', // Dummy secret
    },
  });

  // 6. CHART OF ACCOUNTS
  const accountsData = [
    { code: '1000', name: 'Cash in Bank', type: 'ASSET' },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '1200', name: 'Inventory', type: 'ASSET' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '3000', name: 'Retained Earnings', type: 'EQUITY' },
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
    { code: '5100', name: 'Office Supplies', type: 'EXPENSE' },
    { code: '5200', name: 'Payroll Expense', type: 'EXPENSE' },
    { code: '2100', name: 'Tax Payable', type: 'LIABILITY' },
  ];

  const acctMap: Record<string, any> = {};
  for (const a of accountsData) {
    acctMap[a.code] = await prisma.account.upsert({
      where: { code_tenantId: { code: a.code, tenantId: tenant.id } },
      update: { isActive: true },
      create: { ...a, type: a.type as any, tenantId: tenant.id, balance: 0 },
    });
  }

  // 7. JOURNAL ENTRIES (Opening Balances)
  console.log('Seeding initial ledger transactions...');
  const existingEntries = await prisma.journalEntry.count({ where: { tenantId: tenant.id } });
  if (existingEntries === 0) {
    await prisma.journalEntry.create({
      data: {
        entryNumber: 'JE-000001',
        date: new Date(),
        description: 'Opening Balances',
        status: 'POSTED',
        tenantId: tenant.id,
        createdById: admin.id,
        lines: {
          create: [
            { accountId: acctMap['1000'].id, debit: 50000, baseDebit: 50000, tenantId: tenant.id }, // Cash
            { accountId: acctMap['1200'].id, debit: 10000, baseDebit: 10000, tenantId: tenant.id }, // Inventory
            { accountId: acctMap['3000'].id, credit: 60000, baseCredit: 60000, tenantId: tenant.id }, // Equity
          ]
        }
      }
    });

    // Update account balances manually for opening
    await prisma.account.update({ where: { id: acctMap['1000'].id }, data: { balance: 50000 } });
    await prisma.account.update({ where: { id: acctMap['1200'].id }, data: { balance: 10000 } });
    await prisma.account.update({ where: { id: acctMap['3000'].id }, data: { balance: -60000 } });
  }

  // 8. DEPARTMENTS & EMPLOYEES
  const hrDept = await prisma.department.upsert({
    where: { name_tenantId: { name: 'Human Resources', tenantId: tenant.id } },
    update: {},
    create: { name: 'Human Resources', tenantId: tenant.id }
  });

  const engDept = await prisma.department.upsert({
    where: { name_tenantId: { name: 'Engineering', tenantId: tenant.id } },
    update: {},
    create: { name: 'Engineering', tenantId: tenant.id }
  });

  const employeesData = [
    { code: 'E101', first: 'John', last: 'Doe', email: 'john@amdox.com', pos: 'HR Manager', sal: 75000, rate: 45, dept: hrDept.id },
    { code: 'E102', first: 'Jane', last: 'Smith', email: 'jane@amdox.com', pos: 'Senior Dev', sal: 120000, rate: 75, dept: engDept.id },
  ];

  for (const e of employeesData) {
    await prisma.employee.upsert({
      where: { email_tenantId: { email: e.email, tenantId: tenant.id } },
      update: { salary: e.sal, hourlyRate: e.rate },
      create: {
        employeeCode: e.code,
        firstName: e.first,
        lastName: e.last,
        email: e.email,
        position: e.pos,
        salary: e.sal,
        hourlyRate: e.rate,
        departmentId: e.dept,
        tenantId: tenant.id,
        isActive: true,
        hireDate: new Date(),
      }
    });
  }

  // 9. PRODUCTS & INVENTORY
  const products = [
    { sku: 'LAP-001', name: 'MacBook Pro', price: 2500, threshold: 5 },
    { sku: 'MON-001', name: 'Dell 27" Monitor', price: 450, threshold: 10 },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku_tenantId: { sku: p.sku, tenantId: tenant.id } },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        unitPrice: p.price,
        reorderThreshold: p.threshold,
        tenantId: tenant.id,
      }
    });

    await prisma.inventory.upsert({
      where: { productId_location_tenantId: { productId: product.id, location: 'Main', tenantId: tenant.id } },
      update: { quantity: 20 },
      create: {
        productId: product.id,
        location: 'Main',
        quantity: 20,
        tenantId: tenant.id
      }
    });
  }

  // 10. HISTORICAL DATA FOR ML
  console.log('Seeding historical data for AI...');
  for (let i = 30; i > 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.skuHistory.create({
      data: {
        sku: 'LAP-001',
        quantity: Math.floor(Math.random() * 10) + 1,
        date: date,
        tenantId: tenant.id
      }
    });
  }

  console.log('\n✅ Grand Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
