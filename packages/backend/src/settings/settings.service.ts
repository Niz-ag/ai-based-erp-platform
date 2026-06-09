import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(currentUser: CurrentUserData) {
    let tenantSetting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId: currentUser.tenantId },
    });

    if (!tenantSetting) {
      tenantSetting = await this.prisma.tenantSetting.create({
        data: {
          tenantId: currentUser.tenantId,
          settings: {},
        },
      });
    }

    return tenantSetting;
  }

  async updateSettings(settings: any, currentUser: CurrentUserData) {
    return this.prisma.tenantSetting.upsert({
      where: { tenantId: currentUser.tenantId },
      update: { settings },
      create: {
        tenantId: currentUser.tenantId,
        settings,
      },
    });
  }

  async updateSmtp(smtpSettings: any, currentUser: CurrentUserData) {
    const tenantSetting = await this.getSettings(currentUser);
    const currentSettings = (tenantSetting.settings as any) || {};
    
    const newSettings = {
      ...currentSettings,
      smtp_host: smtpSettings.host,
      smtp_port: smtpSettings.port,
      smtp_user: smtpSettings.user,
      smtp_pass: smtpSettings.password,
      smtp_from: smtpSettings.from,
      smtp_secure: smtpSettings.secure,
    };

    return this.prisma.tenantSetting.update({
      where: { tenantId: currentUser.tenantId },
      data: { settings: newSettings },
    });
  }
}
