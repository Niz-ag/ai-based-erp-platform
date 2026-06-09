import { Controller, Post, UseGuards } from '@nestjs/common';
import { ReplenishmentService } from './replenishment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('replenishment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReplenishmentController {
  constructor(private readonly replenishmentService: ReplenishmentService) {}

  @Post('run')
  @Roles('superadmin', 'admin', 'manager')
  async runAutoReplenishment(@CurrentUser() currentUser: CurrentUserData) {
    return this.replenishmentService.runAutoReplenishment(currentUser);
  }
}
