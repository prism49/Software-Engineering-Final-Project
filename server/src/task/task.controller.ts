import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReviewTaskDto } from './dto/review-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string };
}

@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /** GET /api/tasks/:id — 任务详情 */
  @Get('tasks/:id')
  findOne(@Param('id') id: string) {
    return this.taskService.findOne(Number(id));
  }

  /** GET /api/projects/:id/tasks — 项目任务列表（支持 ?status= 筛选） */
  @Get('projects/:id/tasks')
  findByProject(@Param('id') id: string, @Query('status') status?: string) {
    return this.taskService.findByProject(Number(id), status);
  }

  /** POST /api/projects/:id/tasks — 创建任务（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post('projects/:id/tasks')
  create(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(Number(id), req.user.userId, dto);
  }

  /** PATCH /api/tasks/:id — 更新任务（需登录） */
  @UseGuards(JwtAuthGuard)
  @Patch('tasks/:id')
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(Number(id), req.user.userId, dto);
  }

  /** DELETE /api/tasks/:id — 删除任务（需登录） */
  @UseGuards(JwtAuthGuard)
  @Delete('tasks/:id')
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.taskService.delete(Number(id), req.user.userId);
  }

  /** PATCH /api/tasks/:id/review — 审核任务（需登录） */
  @UseGuards(JwtAuthGuard)
  @Patch('tasks/:id/review')
  review(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReviewTaskDto,
  ) {
    return this.taskService.review(Number(id), req.user.userId, dto);
  }
}