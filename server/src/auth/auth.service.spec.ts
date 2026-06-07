import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService — 工具函数 & 业务逻辑', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    user_id: 1n,
    username: 'testuser',
    email: 'test@example.com',
    password_hash: '$2b$10$hashedpassword',
    nickname: '测试用户',
    role: 'STUDENT' as const,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    is_deleted: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByUsername: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            searchPublicProfiles: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================
  //  register — 注册逻辑
  // ================================================================
  describe('register() — 注册', () => {
    const registerDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123',
      nickname: '新用户',
      role: 'STUDENT' as const,
    };

    it('成功注册返回序列化后的用户（BigInt → Number）', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$mockedhash');
      userService.create.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      // 验证 BigInt 已被转为 Number（可 JSON 序列化）
      expect(result.user_id).toBe(1); // Number, not BigInt
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.nickname).toBe('测试用户');
      expect(result.role).toBe('STUDENT');
      // 不应暴露 password_hash
      expect((result as any).password_hash).toBeUndefined();
    });

    it('用户名已存在抛 ConflictException', async () => {
      userService.findByUsername.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('邮箱已存在抛 ConflictException', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('密码使用 bcrypt 哈希后存储', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$mockedhash');
      userService.create.mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: '$2b$10$mockedhash',
        }),
      );
    });
  });

  // ================================================================
  //  login — 登录逻辑
  // ================================================================
  describe('login() — 登录', () => {
    const loginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('成功登录返回 JWT token 和序列化用户', async () => {
      userService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('jwt-token-xxx');

      const result = await service.login(loginDto);

      // JWT payload 使用 Number（BigInt 不可序列化）
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1, // Number
        username: 'testuser',
        role: 'STUDENT',
      });
      expect(result.access_token).toBe('jwt-token-xxx');
      expect(result.user.user_id).toBe(1);
    });

    it('用户名不存在抛 UnauthorizedException', async () => {
      userService.findByUsername.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('密码错误抛 UnauthorizedException', async () => {
      userService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('错误信息不暴露是用户名还是密码错误', async () => {
      // 不存在的用户
      userService.findByUsername.mockResolvedValue(null);
      const err1 = await service.login(loginDto).catch((e) => e);
      expect(err1.message).toBe('用户名或密码错误');

      // 密码错误
      userService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const err2 = await service.login(loginDto).catch((e) => e);
      expect(err2.message).toBe('用户名或密码错误');
    });
  });

  // ================================================================
  //  getProfile — 用户信息获取
  // ================================================================
  describe('getProfile() — 获取当前用户', () => {
    it('成功获取用户信息', async () => {
      userService.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile(1);
      expect(result.user_id).toBe(1);
      expect(result.role).toBe('STUDENT');
    });

    it('用户不存在抛 UnauthorizedException', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ================================================================
  //  serializeUser — BigInt 转 Number（作为整体逻辑的一部分验证）
  // ================================================================
  describe('BigInt 序列化（间接验证）', () => {
    it('所有返回对象的 user_id 都是 Number 类型', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      userService.create.mockResolvedValue(mockUser);

      const result = await service.register({
        username: 'a',
        email: 'a@a.com',
        password: 'pwd',
        nickname: 'A',
      });
      expect(typeof result.user_id).toBe('number');
      expect(Number.isInteger(result.user_id)).toBe(true);
    });
  });
});