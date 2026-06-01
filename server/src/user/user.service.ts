import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../generated/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /** 根据用户名查找用户（含已删除，用于登录） */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /** 根据邮箱查找用户（用于注册查重） */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /** 根据 ID 查找用户 */
  async findById(userId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { user_id: userId },
    });
  }

  /** 创建新用户 */
  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    nickname: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password_hash: data.passwordHash,
        nickname: data.nickname,
      },
    });
  }
}