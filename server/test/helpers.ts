/**
 * E2E 测试共享工具
 *
 * 提供创建 NestJS 测试 App 的工厂函数和 JWT Token 生成器。
 * 所有测试使用 Mock PrismaService，不依赖真实数据库。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createMockPrisma } from '../src/prisma/__mocks__/prisma.service.mock';
import { JwtService } from '@nestjs/jwt';
import supertest from 'supertest';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const _st = supertest('http://localhost');
type SuperTestInstance = typeof _st;

/** 测试上下文 */
export interface TestAppContext {
  app: INestApplication;
  prisma: ReturnType<typeof createMockPrisma>;
  jwtService: JwtService;
  request: SuperTestInstance;
}

/**
 * 创建测试 App（全局异常过滤器 + 前缀 + ValidationPipe）
 *
 * 会覆盖 PrismaService 为 Mock，避免连接真实数据库。
 */
export async function createTestApp(): Promise<TestAppContext> {
  const mockPrisma = createMockPrisma();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .compile();

  const app = moduleFixture.createNestApplication();

  // 与 main.ts 保持一致
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  await app.init();

  const jwtService = app.get(JwtService);

  return {
    app,
    prisma: mockPrisma,
    jwtService,
    request: supertest(app.getHttpServer()),
  };
}

/**
 * 生成测试用 JWT Token（使用 App 的真实 JwtService / 密钥）
 */
export function createAuthToken(
  jwtService: JwtService,
  user: { userId: number; username: string; role: string },
): string {
  return jwtService.sign({
    sub: user.userId,
    username: user.username,
    role: user.role,
  });
}

/** 测试用学生用户 */
export const testStudent = {
  userId: 1,
  username: 'teststudent',
  role: 'STUDENT' as const,
};

/** 测试用教师用户 */
export const testTeacher = {
  userId: 2,
  username: 'testteacher',
  role: 'TEACHER' as const,
};

/** 测试用 Mock User（由 Prisma 返回） */
export const mockUserRow = {
  user_id: BigInt(1),
  username: 'teststudent',
  email: 'student@test.com',
  password_hash: '$2b$10$hashedpassword',
  nickname: '测试学生',
  role: 'STUDENT' as const,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  is_deleted: false,
};
