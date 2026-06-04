import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  searchPublicProfiles(@Query('keyword') keyword?: string) {
    return this.userService.searchPublicProfiles(keyword);
  }

  @Get(':id')
  async findPublicProfile(@Param('id') id: string) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException('用户编号无效');
    }

    const user = await this.userService.findById(BigInt(numericId));
    if (!user || user.is_deleted) {
      throw new NotFoundException('用户不存在');
    }

    return {
      user_id: Number(user.user_id),
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };
  }
}
