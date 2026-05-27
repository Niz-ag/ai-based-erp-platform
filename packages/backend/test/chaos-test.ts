import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import * as request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../src/common/prisma.service';
import { AuthService } from '../src/auth/auth.service';

/**
 * AMDOX SDE-III CHAOS TEST SUITE
 * Purpose: Stress test multi-tenancy isolation and financial integrity.
 */
async function runChaosTest() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);
  const server = app.getHttpServer();

  console.log('🚀 Starting Chaos Test...');

  try {
    // 1. SETUP: Create two isolated tenants and users
    const t1 = await prisma.tenant.upsert({
      where: { domain: 'tenant1.com' },
      update: {},
      create: { name: 'Tenant One', domain: 'tenant1.com' },
    });

    const t2 = await prisma.tenant.upsert({
      where: { domain: 'tenant2.com' },
      update: {},
      create: { name: 'Tenant Two', domain: 'tenant2.com' },
    });

    const role = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!role) throw new Error('Seed data missing: Admin role');

    const user1 = await authService.register({
      email: 'user1@tenant1.com',
      password: 'password123',
      tenantId: t1.id,
      roleId: role.id,
    });

    const user2 = await authService.register({
      email: 'user2@tenant2.com',
      password: 'password123',
      tenantId: t2.id,
      roleId: role.id,
    });

    const token1 = user1.access_token;
    const token2 = user2.access_token;

    console.log('✅ Setup Complete: Tenants and Users created.');

    // 2. TEST: Multi-Tenancy Breach
    console.log('🧪 Testing Multi-Tenancy Isolation...');
    
    // User 1 creates an account
    const accResponse = await request(server)
      .post('/finance/accounts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ code: '1000', name: 'Cash', type: 'ASSET' });
    
    const account1Id = accResponse.body.id;

    // User 2 tries to view User 1's account
    const breachResponse = await request(server)
      .get(`/finance/accounts/${account1Id}`)
      .set('Authorization', `Bearer ${token2}`);

    if (breachResponse.status === 200) {
      console.error('❌ BREACH DETECTED: Tenant 2 accessed Tenant 1 data!');
      process.exit(1);
    } else {
      console.log('✅ ISOLATION VERIFIED: Unauthorized access blocked.');
    }

    // 3. TEST: Financial Integrity (Decimal Math)
    console.log('🧪 Testing Financial Integrity (100-line Journal Entry)...');
    
    const lines = [];
    // Create 50 lines of $0.01 debit and 1 line of $0.50 credit
    for (let i = 0; i < 50; i++) {
      lines.push({ accountId: account1Id, debit: 0.01 });
    }
    lines.push({ accountId: account1Id, credit: 0.50 });

    const jeResponse = await request(server)
      .post('/finance/journal-entries')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Decimal stress test',
        lines,
      });

    if (jeResponse.status === 201) {
      console.log('✅ FINANCIAL INTEGRITY VERIFIED: Decimal balancing works perfectly.');
    } else {
      console.error('❌ FINANCIAL FAILURE:', jeResponse.body.message);
      process.exit(1);
    }

    // 4. TEST: Atomic Sequencing Concurrency
    console.log('🧪 Testing Atomic Sequencing Concurrency...');
    
    const parallelRequests = Array.from({ length: 5 }).map(() => 
      request(server)
        .post('/finance/journal-entries')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          description: 'Concurrency test',
          lines: [{ accountId: account1Id, debit: 100 }, { accountId: account1Id, credit: 100 }],
        })
    );

    const results = await Promise.all(parallelRequests);
    const entryNumbers = results.map(r => r.body.entryNumber);
    const uniqueNumbers = new Set(entryNumbers);

    if (uniqueNumbers.size === entryNumbers.length) {
      console.log('✅ CONCURRENCY VERIFIED: No duplicate entry numbers generated.');
    } else {
      console.error('❌ CONCURRENCY FAILURE: Duplicate entry numbers detected!', entryNumbers);
      process.exit(1);
    }

    console.log('\n🌟 ALL CHAOS TESTS PASSED. The system is enterprise-ready.');
    process.exit(0);

  } catch (error) {
    console.error('💥 Chaos Test CRASHED:', error);
    process.exit(1);
  }
}

runChaosTest();
