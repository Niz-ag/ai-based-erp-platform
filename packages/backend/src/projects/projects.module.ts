import { Module } from '@nestjs/common';
import { ProjectsController, TasksController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ProjectsController, TasksController],
  providers: [ProjectsService, PrismaService],
  exports: [ProjectsService],
})
export class ProjectsModule {}