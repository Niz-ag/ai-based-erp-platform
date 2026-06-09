import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // ============ Projects ============

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllProjects(@CurrentUser() currentUser: CurrentUserData) {
    return this.projectsService.findAllProjects(currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  createProject(
    @Body() createProjectDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.createProject(createProjectDto, currentUser);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findProjectById(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.findProjectById(id, currentUser);
  }

  @Put(':id')
  @Roles('superadmin', 'admin', 'manager')
  updateProject(
    @Param('id') id: string,
    @Body() updateProjectDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.updateProject(id, updateProjectDto, currentUser);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin', 'manager')
  deleteProject(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.deleteProject(id, currentUser);
  }

  // ============ Resources ============

  @Get('resources/workload')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getResourceWorkload(@CurrentUser() currentUser: CurrentUserData) {
    return this.projectsService.getResourceWorkload(currentUser);
  }

  // ============ Tasks (within project) ============

  @Post(':id/tasks')
  @Roles('superadmin', 'admin', 'manager')
  createTask(
    @Param('id') projectId: string,
    @Body() createTaskDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.createTask(projectId, createTaskDto, currentUser);
  }

  // ============ Milestones ============

  @Get('milestones/all')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllMilestones(
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.findAllMilestones(currentUser, projectId);
  }

  @Post('milestones')
  @Roles('superadmin', 'admin', 'manager')
  createMilestone(
    @Body() createMilestoneDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.createMilestone(createMilestoneDto, currentUser);
  }

  @Put('milestones/:id')
  @Roles('superadmin', 'admin', 'manager')
  updateMilestone(
    @Param('id') id: string,
    @Body() updateMilestoneDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.updateMilestone(id, updateMilestoneDto, currentUser);
  }

  @Delete('milestones/:id')
  @Roles('superadmin', 'admin', 'manager')
  deleteMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.deleteMilestone(id, currentUser);
  }

  // ============ Budget ============

  @Get(':id/budget')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getProjectBudget(
    @Param('id') projectId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.getProjectBudget(projectId, currentUser);
  }

  @Put(':id/budget')
  @Roles('superadmin', 'admin', 'manager')
  updateProjectBudget(
    @Param('id') projectId: string,
    @Body() updateBudgetDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.updateProjectBudget(projectId, updateBudgetDto, currentUser);
  }
}

// Separate controller for direct task endpoints
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private projectsService: ProjectsService) {}

  @Put(':id')
  @Roles('superadmin', 'admin', 'manager')
  updateTask(
    @Param('id') id: string,
    @Body() updateTaskDto: any,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.updateTask(id, updateTaskDto, currentUser);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin', 'manager')
  deleteTask(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.projectsService.deleteTask(id, currentUser);
  }
}