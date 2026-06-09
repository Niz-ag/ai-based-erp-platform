import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GlobalSearchService } from './search.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('viewer')
export class GlobalSearchController {
  constructor(private readonly searchService: GlobalSearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.searchService.search(query, currentUser);
  }
}
