/**
 * E2E — 互评接口测试
 *
 * 覆盖：
 *   POST /api/projects/:id/reviews     — 提交互评（需登录，项目 CLOSED）
 *   GET  /api/projects/:id/reviews     — 查看互评（学生只看自己被评，教师看全部）
 *   PUT  /api/reviews/:id              — 修改评分（仅评分人）
 */

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  createTestApp,
  TestAppContext,
  createAuthToken,
} from './helpers';

describe('Review — 互评接口 (e2e)', () => {
  let app: INestApplication;
  let prisma: TestAppContext['prisma'];
  let jwtService: JwtService;
  let http: request.SuperTest<request.Test>;

  const studentA = { userId: 1, username: 'studentA', role: 'STUDENT' as const };
  const studentB = { userId: 3, username: 'studentB', role: 'STUDENT' as const };
  const teacher = { userId: 2, username: 'teacher', role: 'TEACHER' as const };

  let studentAToken: string;
  let studentBToken: string;
  let teacherToken: string;

  /** 构造已关闭的项目 */
  const makeClosedProject = (overrides: any = {}) => ({
    project_id: BigInt(1),
    leader_id: BigInt(1),
    title: '已完成项目',
    description: null,
    max_members: 5,
    status: 'CLOSED',
    deadline: new Date('2026-01-01'),
    created_at: new Date(),
    updated_at: new Date(),
    is_deleted: false,
    leader: { user_id: BigInt(1), username: 'leader', nickname: '队长' },
    members: [
      { user_id: BigInt(1), role: 'LEADER', status: 'APPROVED', is_deleted: false },
      { user_id: BigInt(3), role: 'MEMBER', status: 'APPROVED', is_deleted: false },
    ],
    milestones: [],
    project_required_tags: [],
    _count: { tasks: 0 },
    ...overrides,
  });

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    jwtService = ctx.jwtService;
    http = ctx.request;

    studentAToken = createAuthToken(jwtService, studentA);
    studentBToken = createAuthToken(jwtService, studentB);
    teacherToken = createAuthToken(jwtService, teacher);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ================================================================
  //  POST /api/projects/:id/reviews — 提交互评
  // ================================================================
  describe('POST /api/projects/:id/reviews — 提交互评', () => {
    const reviewPayload = {
      target_id: 3,
      score: 4,
      content: '合作愉快！',
    };

    it('成功提交互评', async () => {
      // 校验当前用户是项目成员
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
      });
      // 项目已关闭
      prisma.project.findFirst.mockResolvedValueOnce(makeClosedProject());
      // 校验被评人是项目成员
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(3),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      // 没有已有的评分记录
      prisma.peerReview.findFirst.mockResolvedValueOnce(null);
      prisma.peerReview.create.mockResolvedValueOnce({
        review_id: BigInt(10),
      });

      const res = await http
        .post('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send(reviewPayload);

      expect(res.status).toBe(201);
      expect(res.body.review_id).toBe(10);
      expect(res.body.message).toBe('评分已提交');
    });

    it('项目未关闭不能提交 — 400', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.project.findFirst.mockResolvedValueOnce(
        makeClosedProject({ status: 'ACTIVE' }),
      );

      const res = await http
        .post('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send(reviewPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('关闭后');
    });

    it('不能给自己评分 — 400', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.project.findFirst.mockResolvedValueOnce(makeClosedProject());

      const res = await http
        .post('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ ...reviewPayload, target_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('不能给自己评分');
    });

    it('不能重复创建互评 — 409', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.project.findFirst.mockResolvedValueOnce(makeClosedProject());
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(3),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      // 已有评分记录
      prisma.peerReview.findFirst.mockResolvedValueOnce({
        review_id: BigInt(5),
        project_id: BigInt(1),
        reviewer_id: BigInt(1),
        target_id: BigInt(3),
        is_deleted: false,
      });

      const res = await http
        .post('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send(reviewPayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('已经对该成员评过分');
    });

    it('非项目成员不能提交 — 403', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce(null);

      const res = await http
        .post('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentBToken}`)
        .send(reviewPayload);

      expect(res.status).toBe(403);
    });

    it('未登录返回 401', async () => {
      const res = await http.post('/api/projects/1/reviews').send(reviewPayload);
      expect(res.status).toBe(401);
    });

    it('评分超出范围返回 400', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.project.findFirst.mockResolvedValueOnce(makeClosedProject());

      const res = await http
        .post('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ ...reviewPayload, score: 99 });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  //  GET /api/projects/:id/reviews — 查看互评
  // ================================================================
  describe('GET /api/projects/:id/reviews — 查看互评', () => {
    it('教师可以看到全部互评数据（含评分人和被评人）', async () => {
      prisma.peerReview.findMany.mockResolvedValueOnce([
        {
          review_id: BigInt(1),
          project_id: BigInt(1),
          reviewer_id: BigInt(1),
          target_id: BigInt(3),
          score: 4,
          content: '很好',
          created_at: new Date(),
          is_deleted: false,
          reviewer: { user_id: BigInt(1), username: 'studentA', nickname: '学生A' },
          target: { user_id: BigInt(3), username: 'studentB', nickname: '学生B' },
        },
      ]);

      const res = await http
        .get('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      // 教师能看到完整评分人和被评人
      expect(res.body[0].reviewer).toBeDefined();
      expect(res.body[0].target).toBeDefined();
      expect(res.body[0].reviewer.nickname).toBe('学生A');
    });

    it('学生只能看到自己被评的数据（不暴露评分人）', async () => {
      // studentA 是 reviewer，studentB 是 target
      prisma.peerReview.findMany.mockResolvedValueOnce([
        {
          review_id: BigInt(1),
          project_id: BigInt(1),
          reviewer_id: BigInt(1),
          target_id: BigInt(1),
          score: 5,
          content: '优秀',
          created_at: new Date(),
          is_deleted: false,
          reviewer: { user_id: BigInt(1), username: 'studentA', nickname: '学生A' },
          target: { user_id: BigInt(1), username: 'studentA', nickname: '学生A' },
        },
      ]);

      const res = await http
        .get('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      // 学生的返回中不应有 reviewer 和 target 字段
      expect(res.body[0].reviewer).toBeUndefined();
      expect(res.body[0].score).toBe(5);
    });

    it('学生看不到自己评别人的数据', async () => {
      // studentA 评了 studentB
      prisma.peerReview.findMany.mockResolvedValueOnce([
        {
          review_id: BigInt(1),
          project_id: BigInt(1),
          reviewer_id: BigInt(1),
          target_id: BigInt(3),
          score: 4,
          content: '不错',
          created_at: new Date(),
          is_deleted: false,
          reviewer: { user_id: BigInt(1), username: 'studentA', nickname: '学生A' },
          target: { user_id: BigInt(3), username: 'studentB', nickname: '学生B' },
        },
      ]);

      const res = await http
        .get('/api/projects/1/reviews')
        .set('Authorization', `Bearer ${studentAToken}`);

      // studentA 的 target_id 是 3，不是自己的 1，所以被过滤掉
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });

    it('未登录返回 401', async () => {
      const res = await http.get('/api/projects/1/reviews');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  //  PUT /api/reviews/:id — 修改评分
  // ================================================================
  describe('PUT /api/reviews/:id — 修改评分', () => {
    it('评分人可修改自己的评分', async () => {
      prisma.peerReview.findFirst.mockResolvedValueOnce({
        review_id: BigInt(1),
        project_id: BigInt(1),
        reviewer_id: BigInt(1),
        target_id: BigInt(3),
        score: 4,
        content: '很好',
        is_deleted: false,
      });
      prisma.peerReview.update.mockResolvedValueOnce({});

      const res = await http
        .put('/api/reviews/1')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ score: 5, content: '非常好' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('评分已更新');
    });

    it('非评分人不能修改 — 403', async () => {
      prisma.peerReview.findFirst.mockResolvedValueOnce({
        review_id: BigInt(1),
        project_id: BigInt(1),
        reviewer_id: BigInt(1),
        target_id: BigInt(3),
        score: 4,
        is_deleted: false,
      });

      const res = await http
        .put('/api/reviews/1')
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ score: 5 });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('只能修改自己的评分');
    });

    it('评分记录不存在返回 404', async () => {
      prisma.peerReview.findFirst.mockResolvedValueOnce(null);

      const res = await http
        .put('/api/reviews/999')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ score: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('评分记录不存在');
    });

    it('未登录返回 401', async () => {
      const res = await http
        .put('/api/reviews/1')
        .send({ score: 5 });
      expect(res.status).toBe(401);
    });
  });
});
