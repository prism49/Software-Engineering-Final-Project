import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../generated/client';

/** 将 User 转为可 JSON 序列化的对象（BigInt → Number） */
function serializeUser(user: User) {
  return {
    user_id: Number(user.user_id),
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    created_at: user.created_at,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /** 注册 */
  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByUsername(dto.username);
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    const existingEmail = await this.userService.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userService.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      nickname: dto.nickname,
      role: dto.role ?? 'STUDENT',
    });

    return serializeUser(user);
  }

  /** 登录 */
  async login(dto: LoginDto) {
    const user = await this.userService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // JWT payload 使用 Number（BigInt 不可序列化）
    const payload = { sub: Number(user.user_id), username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      user: serializeUser(user),
    };
  }

  /** 获取当前用户信息 */
  async getProfile(userId: number) {
    const user = await this.userService.findById(BigInt(userId));
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return serializeUser(user);
  }
}