import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import { tenantContextStorage } from '../src/common/tenant-context';
import * as http from 'http';

async function runWebhookTest() {
  const app = await NestFactory.create(AppModule);
  await app.init();

  const prisma = app.get(PrismaService);
  const webhooksService = app.get(WebhooksService);

  console.log('🚀 Starting Webhook Workflow Test...');

  // Start a local server to receive the webhook
  let receivedPayload: any = null;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      receivedPayload = JSON.parse(body);
      console.log('📥 Received Webhook Payload:', receivedPayload);
      res.writeHead(200);
      res.end();
    });
  });

  const port = 3333;
  server.listen(port);
  const webhookUrl = `http://localhost:${port}/webhook`;

  try {
    // 1. Setup Tenant
    const tenant = await prisma.tenant.upsert({
      where: { domain: 'webhook-test.com' },
      update: {},
      create: { name: 'Webhook Test Tenant', domain: 'webhook-test.com' },
    });

    console.log(`✅ Tenant created: ${tenant.id}`);

    // 2. Create Webhook Subscription
    // We must run this in tenant context
    const subscription = await tenantContextStorage.run({ tenantId: tenant.id }, async () => {
      return prisma.webhookSubscription.create({
        data: {
          url: webhookUrl,
          events: ['PRODUCT_CREATED'],
          isActive: true,
          tenant: { connect: { id: tenant.id } }
        }
      });
    });

    console.log(`✅ Webhook Subscription created: ${subscription.id}`);

    // 3. Trigger Mutation (Create a Product)
    console.log('🧪 Creating a product to trigger webhook...');
    const product = await tenantContextStorage.run({ tenantId: tenant.id }, async () => {
      return prisma.product.create({
        data: {
          name: 'Test Product',
          sku: `TEST-SKU-${Date.now()}`,
          unitPrice: 99.99,
          tenant: { connect: { id: tenant.id } }
        }
      });
    });

    console.log(`✅ Product created: ${product.id}`);

    // 4. Wait for Webhook Delivery (async)
    console.log('⏳ Waiting for webhook delivery...');
    for (let i = 0; i < 10; i++) {
      if (receivedPayload) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (receivedPayload) {
      console.log('✅ SUCCESS: Webhook received by local server!');
      if (receivedPayload.id === product.id) {
        console.log('✅ SUCCESS: Payload matches created product!');
      } else {
        console.error('❌ FAILURE: Payload mismatch!');
        process.exit(1);
      }
    } else {
      console.error('❌ FAILURE: Webhook not received!');
      // Check for deliveries in DB
      const deliveries = await prisma.webhookDelivery.findMany({
        where: { tenantId: tenant.id }
      });
      console.log('Deliveries in DB:', deliveries);
      process.exit(1);
    }

    // 5. Check Delivery Log
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { tenantId: tenant.id, event: 'PRODUCT_CREATED' }
    });

    if (delivery && delivery.responseCode === 200) {
      console.log('✅ SUCCESS: WebhookDelivery log verified with status 200.');
    } else {
      console.error('❌ FAILURE: WebhookDelivery log missing or incorrect status!', delivery);
      process.exit(1);
    }

    console.log('\n🌟 WEBHOOK WORKFLOW VERIFIED SUCCESSFULLY.');
    server.close();
    process.exit(0);

  } catch (error) {
    console.error('💥 Test Failed:', error);
    server.close();
    process.exit(1);
  }
}

runWebhookTest();
