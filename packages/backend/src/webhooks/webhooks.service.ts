import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { DeliveryStatus } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async getAll(tenantId: string) {
    return this.prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { url: string; events: string[]; secret?: string }, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    return this.prisma.webhookSubscription.create({
      data: {
        url: data.url,
        events: data.events,
        secret: data.secret,
        tenant: { connect: { id: contextTenantId } },
      },
    });
  }

  async getOne(id: string) {
    const webhook = await this.prisma.webhookSubscription.findUnique({
      where: { id },
      include: { webhookDeliveries: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(id: string, data: { url?: string; events?: string[]; isActive?: boolean }) {
    return this.prisma.webhookSubscription.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.webhookSubscription.delete({ where: { id } });
  }

  async testWebhook(id: string) {
    const webhook = await this.prisma.webhookSubscription.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const tenantId = tenantContextStorage.getStore()?.tenantId;

    // Create a test delivery
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        subscription: { connect: { id } },
        event: 'TEST_WEBHOOK',
        payload: { test: true, timestamp: new Date().toISOString() },
        status: DeliveryStatus.PENDING,
        tenant: { connect: { id: tenantId } },
      },
    });

    // Try to deliver (synchronously for test)
    try {
      // In production, this would be async and queued via BullMQ
      // Simulating a webhook call attempt
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'TEST_WEBHOOK',
          'X-Webhook-Signature': webhook.secret ? 'test-signature' : '',
        },
        body: JSON.stringify(delivery.payload),
      }).catch(() => null);

      const status = response?.ok ? DeliveryStatus.SUCCESS : DeliveryStatus.FAILED;

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status,
          responseCode: response?.status || 0,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });

      return { success: status === DeliveryStatus.SUCCESS, delivery };
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.FAILED,
          responseBody: error.message,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });
      return { success: false, delivery, error: error.message };
    }
  }

  async getDeliveries(subscriptionId: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async trigger(event: string, payload: any, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    });

    for (const sub of subscriptions) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          subscription: { connect: { id: sub.id } },
          event,
          payload,
          status: DeliveryStatus.PENDING,
          tenant: { connect: { id: contextTenantId } },
        },
      });

      // Background delivery (simplified for demo)
      this.deliver(sub, delivery).catch(console.error);
    }
  }

  private async deliver(sub: any, delivery: any) {
    try {
      const response = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': delivery.event,
        },
        body: JSON.stringify(delivery.payload),
      });

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? DeliveryStatus.SUCCESS : DeliveryStatus.FAILED,
          responseCode: response.status,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });
    } catch (err) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.FAILED,
          responseBody: err.message,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });
    }
  }
  }