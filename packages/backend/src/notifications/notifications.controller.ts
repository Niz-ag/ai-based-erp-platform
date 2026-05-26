import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Body,
  UseGuards,
  Res,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { NotificationsService, addSseClient, removeSseClient } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData, @Query('unread') unread?: string) {
    if (unread === 'true') {
      return this.notificationsService.findUnread(currentUser);
    }
    return this.notificationsService.findAll(currentUser, true);
  }

  @Get('count')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getUnreadCount(@CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.getUnreadCount(currentUser);
  }

  @Patch(':id/read')
  @Roles('superadmin', 'admin', 'manager')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.notificationsService.markAsRead(id, currentUser);
  }

  @Patch('read-all')
  @Roles('superadmin', 'admin', 'manager')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.markAllAsRead(currentUser);
  }

  // SSE endpoint for real-time notifications
  @Get('stream')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  stream(@CurrentUser() currentUser: CurrentUserData, @Res() res: Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Add this client to the registry
    addSseClient(currentUser.id, res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Notification stream connected' })}\n\n`);

    // Handle client disconnect
    res.on('close', () => {
      removeSseClient(currentUser.id, res);
    });
  }

  // Preferences endpoints
  @Get('preferences')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getPreferences(@CurrentUser() currentUser: CurrentUserData) {
    return this.notificationsService.getPreferences(currentUser);
  }

  @Put('preferences')
  @Roles('superadmin', 'admin', 'manager')
  updatePreferences(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() data: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      notifyOnLeaveRequest?: boolean;
      notifyOnPurchaseOrder?: boolean;
      notifyOnInventory?: boolean;
      notifyOnSystem?: boolean;
    },
  ) {
    return this.notificationsService.updatePreferences(currentUser, data);
  }
}