import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ApplyProjectDto } from './dto/apply-project.dto';
import { ApproveMemberDto } from './dto/approve-member.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string };
}

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /** GET /api/projects — 项目大厅 */
  @Get()
  findAll(@Query() query: QueryProjectDto) {
    return this.projectService.findAll(query);
  }

  /** GET /api/projects/:id — 项目详情 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(Number(id));
  }

  /** POST /api/projects — 创建项目（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProjectDto) {
    return this.projectService.create(req.user.userId, dto);
  }

  /** PATCH /api/projects/:id — 修改项目（队长） */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(Number(id), req.user.userId, dto);
  }

  /** POST /api/projects/:id/apply — 申请加入（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApplyProjectDto,
  ) {
    return this.projectService.apply(Number(id), req.user.userId, dto);
  }

  /** PATCH /api/projects/:id/members/:userId — 审批成员（队长） */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:userId')
  approveMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApproveMemberDto,
  ) {
    return this.projectService.approveMember(
      Number(id),
      Number(userId),
      req.user.userId,
      dto,
    );
  }
}