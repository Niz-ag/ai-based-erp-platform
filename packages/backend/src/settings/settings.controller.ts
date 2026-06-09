import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getSettings(@CurrentUser() currentUser: CurrentUserData) {
    return this.settingsService.getSettings(currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin')
  updateSettings(
    @Body() settings: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.settingsService.updateSettings(settings, currentUser);
  }

  @Post('smtp')
  @Roles('superadmin', 'admin')
  updateSmtp(
    @Body() smtpSettings: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.settingsService.updateSmtp(smtpSettings, currentUser);
  }
}
