import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { TagService } from './tag.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsArray, IsInt } from 'class-validator';
import { Request } from 'express';

class UpdateUserTagsDto {
  @IsArray()
  @IsInt({ each: true })
  tag_ids!: number[];
}

interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string };
}

@Controller()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  /** GET /api/tags */
  @Get('tags')
  findAll() {
    return this.tagService.findAll();
  }

  /** GET /api/users/me/tags */
  @UseGuards(JwtAuthGuard)
  @Get('users/me/tags')
  findUserTags(@Req() req: AuthenticatedRequest) {
    return this.tagService.findUserTags(req.user.userId);
  }

  /** PUT /api/users/me/tags */
  @UseGuards(JwtAuthGuard)
  @Put('users/me/tags')
  updateUserTags(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateUserTagsDto,
  ) {
    return this.tagService.updateUserTags(req.user.userId, dto.tag_ids);
  }
}