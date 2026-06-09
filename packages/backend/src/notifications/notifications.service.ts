import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';
import { EventBusService } from '../common/event-bus.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

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
    const tenantId = tenantContextStorage.getStore()?.tenantId || '';
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

    // Send to SSE via EventBus
    this.eventBus.emitModelEvent({
      model: 'Notification',
      operation: 'CREATE',
      data: notification,
      tenantId: tenantId,
    });

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