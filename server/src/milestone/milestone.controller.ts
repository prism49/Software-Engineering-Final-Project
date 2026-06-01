import { Controller, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { MilestoneService } from './milestone.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string };
}

@Controller()
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  /** POST /api/projects/:id/milestones */
  @UseGuards(JwtAuthGuard)
  @Post('projects/:id/milestones')
  create(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestoneService.create(Number(id), req.user.userId, dto);
  }

  /** PATCH /api/milestones/:id */
  @UseGuards(JwtAuthGuard)
  @Patch('milestones/:id')
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestoneService.update(Number(id), req.user.userId, dto);
  }

  /** DELETE /api/milestones/:id — 删除里程碑 */
  @UseGuards(JwtAuthGuard)
  @Delete('milestones/:id')
  delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.milestoneService.delete(Number(id), req.user.userId);
  }

  /** POST /api/milestones/:id/complete — 完成里程碑 */
  @UseGuards(JwtAuthGuard)
  @Post('milestones/:id/complete')
  complete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.milestoneService.complete(Number(id), req.user.userId);
  }
}