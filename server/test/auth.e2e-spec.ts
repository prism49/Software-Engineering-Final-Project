/**
 * E2E — 认证接口测试
 *
 * 覆盖：
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *
 * 实现方式：Mock PrismaService，测试 Controller + Service + Guard 全链路。
 */
jest.mock('bcrypt');

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestAppContext, mockUserRow } from './helpers';

describe('Auth — 认证接口 (e2e)', () => {
  let app: INestApplication;
  let prisma: TestAppContext['prisma'];
  let jwtService: JwtService;
  let http: request.SuperTest<request.Test>;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    jwtService = ctx.jwtService;
    http = ctx.request;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ================================================================
  //  POST /api/auth/register
  // ================================================================
  describe('POST /api/auth/register — 注册', () => {
    const registerPayload = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123',
      nickname: '新用户',
      role: 'STUDENT',
    };

    it('成功注册返回用户信息（不含 password_hash）', async () => {
      // findByUsername → null
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // findByEmail → null
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // create → mockUser
      prisma.user.create.mockResolvedValueOnce(mockUserRow);

      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.hash.mockResolvedValue('$2b$10$mockedhash');

      const res = await http.post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(1);
      expect(res.body.username).toBe('teststudent');
      expect(res.body.role).toBe('STUDENT');
      expect(res.body.password_hash).toBeUndefined();
    });

    it('用户名重复返回 409', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUserRow);

      const res = await http.post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('用户名已存在');
    });

    it('邮箱重复返回 409', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // username 可用
      prisma.user.findUnique.mockResolvedValueOnce(mockUserRow); // email 已存在

      const res = await http.post('/api/auth/register').send(registerPayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('邮箱已被注册');
    });

    it('缺少必填字段返回 400', async () => {
      const res = await http.post('/api/auth/register').send({});

      expect(res.status).toBe(400);
    });

    it('密码过短返回 400', async () => {
      const res = await http
        .post('/api/auth/register')
        .send({ ...registerPayload, password: '123' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  //  POST /api/auth/login
  // ================================================================
  describe('POST /api/auth/login — 登录', () => {
    const loginPayload = { username: 'teststudent', password: 'password123' };

    it('成功登录返回 access_token 和用户信息', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUserRow);

      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.compare.mockResolvedValue(true);

      const res = await http.post('/api/auth/login').send(loginPayload);

      expect(res.status).toBe(201);
      expect(res.body.access_token).toBeDefined();
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.user.user_id).toBe(1);
      expect(res.body.user.username).toBe('teststudent');
    });

    it('用户名不存在返回 401', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const res = await http.post('/api/auth/login').send(loginPayload);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('用户名或密码错误');
    });

    it('密码错误返回 401', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUserRow);

      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.compare.mockResolvedValue(false);

      const res = await http.post('/api/auth/login').send(loginPayload);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('用户名或密码错误');
    });

    it('错误信息不区分用户名还是密码错误', async () => {
      // 用户名不存在
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const res1 = await http.post('/api/auth/login').send(loginPayload);
      expect(res1.body.message).toBe('用户名或密码错误');

      // 密码错误
      prisma.user.findUnique.mockResolvedValueOnce(mockUserRow);
      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.compare.mockResolvedValue(false);
      const res2 = await http.post('/api/auth/login').send(loginPayload);
      expect(res2.body.message).toBe('用户名或密码错误');
    });
  });

  // ================================================================
  //  GET /api/auth/me
  // ================================================================
  describe('GET /api/auth/me — 当前用户', () => {
    it('携带有效 JWT 返回用户信息', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUserRow);

      const token = jwtService.sign({
        sub: 1,
        username: 'teststudent',
        role: 'STUDENT',
      });

      const res = await http
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user_id).toBe(1);
      expect(res.body.username).toBe('teststudent');
    });

    it('不携带 Token 返回 401', async () => {
      const res = await http.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('携带无效 Token 返回 401', async () => {
      const res = await http
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('用户不存在返回 401', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const token = jwtService.sign({
        sub: 999,
        username: 'ghost',
        role: 'STUDENT',
      });

      const res = await http
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('用户不存在');
    });
  });
});
