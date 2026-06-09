import { Module } from '@nestjs/common';
import { ProjectsController, TasksController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../common/prisma.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  controllers: [ProjectsController, TasksController],
  providers: [ProjectsService, PrismaService],
  imports: [FinanceModule],
  exports: [ProjectsService],
})
export class ProjectsModule {}