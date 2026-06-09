import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Body,
  UseGuards,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { EventBusService } from '../common/event-bus.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private eventBusService: EventBusService,
  ) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData, @Query('unread') unread?: string) {
    if (unread === 'true') {
      return this.notificationsService.findUnread(currentUser);
    }
    return this.notificationsService.findAll(currentUser, true);
  }

  @Get('unread-count')
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
  @Sse('stream')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  stream(@CurrentUser() currentUser: CurrentUserData): Observable<MessageEvent> {
    return this.eventBusService.onModelEvent().pipe(
      filter(event => event.tenantId === currentUser.tenantId),
      map(event => ({
        data: event,
      } as MessageEvent)),
    );
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