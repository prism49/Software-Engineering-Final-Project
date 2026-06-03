import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string; role: string };
}

@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /** POST /api/projects/:id/reviews — 提交互评 */
  @UseGuards(JwtAuthGuard)
  @Post('projects/:id/reviews')
  create(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewService.create(Number(id), req.user.userId, dto);
  }

  /** GET /api/projects/:id/reviews — 查看互评 */
  @UseGuards(JwtAuthGuard)
  @Get('projects/:id/reviews')
  findByProject(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.reviewService.findByProject(Number(id), req.user.userId, req.user.role);
  }

  /** PUT /api/reviews/:id — 修改评分 */
  @UseGuards(JwtAuthGuard)
  @Put('reviews/:id')
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.update(Number(id), req.user.userId, dto);
  }
}
