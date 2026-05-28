import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';

// SSE client interface for Express response objects
interface SseClient {
  write(data: string): boolean;
}

// SSE clients registry - Maps userId to Set of response objects
const sseClients = new Map<string, Set<SseClient>>();

export function addSseClient(userId: string, client: SseClient) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(client);
}

export function removeSseClient(userId: string, client: SseClient) {
  const clients = sseClients.get(userId);
  if (clients) {
    clients.delete(client);
    if (clients.size === 0) {
      sseClients.delete(userId);
    }
  }
}

export function sendNotificationToUser(userId: string, notification: any) {
  const clients = sseClients.get(userId);
  if (clients) {
    const data = `data: ${JSON.stringify(notification)}\n\n`;
    clients.forEach((client) => {
      client.write(data);
    });
  }
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData, includeRead = true) {
    const where: any = {
      userId: currentUser.id,
    };

    if (!includeRead) {
      where.isRead = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async findUnread(currentUser: CurrentUserData) {
    return this.findAll(currentUser, false);
  }

  async markAsRead(id: string, currentUser: CurrentUserData) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId: currentUser.id,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(currentUser: CurrentUserData) {
    return this.prisma.notification.updateMany({
      where: {
        userId: currentUser.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(currentUser: CurrentUserData) {
    return this.prisma.notification.count({
      where: {
        userId: currentUser.id,
        isRead: false,
      },
    });
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
  ) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    const notification = await this.prisma.notification.create({
      data: {
        user: { connect: { id: userId } },
        type,
        title,
        message,
        data: data || undefined,
        tenant: { connect: { id: tenantId } },
      },
    });

    // Send to SSE clients
    sendNotificationToUser(userId, notification);

    return notification;
  }

  // Preferences methods
  async getPreferences(currentUser: CurrentUserData) {
    let preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId: currentUser.id },
    });

    if (!preferences) {
      const tenantId = tenantContextStorage.getStore()?.tenantId;
      preferences = await this.prisma.notificationPreference.create({
        data: {
          user: { connect: { id: currentUser.id } },
          tenant: { connect: { id: tenantId } },
        },
      });
    }

    return preferences;
  }

  async updatePreferences(
    currentUser: CurrentUserData,
    data: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      notifyOnLeaveRequest?: boolean;
      notifyOnPurchaseOrder?: boolean;
      notifyOnInventory?: boolean;
      notifyOnSystem?: boolean;
    },
  ) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    return this.prisma.notificationPreference.upsert({
      where: { userId: currentUser.id },
      create: {
        user: { connect: { id: currentUser.id } },
        tenant: { connect: { id: tenantId } },
        ...data,
      },
      update: data,
    });
  }
}