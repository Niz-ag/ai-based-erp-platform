import { Module } from '@nestjs/common';
import { GlobalSearchService } from './search.service';
import { GlobalSearchController } from './search.controller';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GlobalSearchService],
  controllers: [GlobalSearchController],
  exports: [GlobalSearchService],
})
export class SearchModule {}
