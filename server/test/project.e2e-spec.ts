/**
 * E2E — 项目接口测试
 *
 * 覆盖：
 *   GET    /api/projects                         — 项目大厅（支持 ?status= & ?tag= 筛选）
 *   GET    /api/projects/:id                     — 项目详情
 *   POST   /api/projects                         — 创建项目（需登录）
 *   PATCH  /api/projects/:id                     — 修改项目（队长）
 *   POST   /api/projects/:id/apply               — 申请加入
 *   PATCH  /api/projects/:id/members/:userId     — 审批成员（队长）
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestAppContext, createAuthToken } from './helpers';

describe('Project — 项目接口 (e2e)', () => {
  let app: INestApplication;
  let prisma: TestAppContext['prisma'];
  let jwtService: JwtService;
  let http: request.SuperTest<request.Test>;
  let leaderToken: string;
  let memberToken: string;

  const leaderUser = { userId: 1, username: 'leader', role: 'STUDENT' as const };
  const memberUser = { userId: 2, username: 'member', role: 'STUDENT' as const };

  /** 构造一个项目行（数据库格式） */
  const makeProject = (overrides: any = {}) => ({
    project_id: BigInt(1),
    leader_id: BigInt(1),
    title: '测试项目',
    description: '这是一个测试项目',
    max_members: 5,
    status: 'RECRUITING',
    deadline: new Date('2026-12-31'),
    created_at: new Date(),
    updated_at: new Date(),
    is_deleted: false,
    leader: { user_id: BigInt(1), username: 'leader', nickname: '队长' },
    members: [
      {
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
        user: { user_id: BigInt(1), username: 'leader', nickname: '队长' },
        joined_at: new Date(),
      },
    ],
    project_required_tags: [],
    milestones: [],
    _count: { tasks: 0 },
    ...overrides,
  });

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    jwtService = ctx.jwtService;
    http = ctx.request;

    leaderToken = createAuthToken(jwtService, leaderUser);
    memberToken = createAuthToken(jwtService, memberUser);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ================================================================
  //  GET /api/projects — 项目大厅
  // ================================================================
  describe('GET /api/projects — 项目大厅', () => {
    it('返回项目列表', async () => {
      prisma.project.findMany.mockResolvedValueOnce([makeProject()]);

      const res = await http.get('/api/projects');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('测试项目');
      expect(res.body[0].project_id).toBe(1);
    });

    it('支持 ?status= 筛选', async () => {
      prisma.project.findMany.mockResolvedValueOnce([]);

      const res = await http.get('/api/projects?status=ACTIVE');

      expect(res.status).toBe(200);
      // 验证传递给 Prisma 的查询条件包含 status: 'ACTIVE'
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('支持 ?tag= 筛选', async () => {
      prisma.project.findMany.mockResolvedValueOnce([]);

      await http.get('/api/projects?tag=前端');

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_required_tags: {
              some: { tag: { name: '前端' } },
            },
          }),
        }),
      );
    });

    it('公开接口 — 不登录也能访问', async () => {
      prisma.project.findMany.mockResolvedValueOnce([]);

      const res = await http.get('/api/projects');

      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  //  GET /api/projects/:id — 项目详情
  // ================================================================
  describe('GET /api/projects/:id — 项目详情', () => {
    it('返回项目完整信息', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(makeProject());

      const res = await http.get('/api/projects/1');

      expect(res.status).toBe(200);
      expect(res.body.project_id).toBe(1);
      expect(res.body.title).toBe('测试项目');
      expect(res.body.leader.username).toBe('leader');
    });

    it('项目不存在返回 404', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(null);

      const res = await http.get('/api/projects/999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('项目不存在');
    });

    it('已删除项目视为不存在', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(null);

      const res = await http.get('/api/projects/1');

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  //  POST /api/projects — 创建项目
  // ================================================================
  describe('POST /api/projects — 创建项目', () => {
    const createPayload = {
      title: '新项目',
      description: '项目描述',
      max_members: 5,
      deadline: '2026-12-31',
      tag_ids: [1, 2],
    };

    it('登录用户可以创建项目', async () => {
      prisma.project.create.mockResolvedValueOnce({
        project_id: BigInt(2),
        title: '新项目',
      });

      const res = await http
        .post('/api/projects')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send(createPayload);

      expect(res.status).toBe(201);
      expect(res.body.project_id).toBe(2);
      expect(res.body.title).toBe('新项目');
    });

    it('未登录返回 401', async () => {
      const res = await http.post('/api/projects').send(createPayload);
      expect(res.status).toBe(401);
    });

    it('缺少必填字段返回 400', async () => {
      const res = await http
        .post('/api/projects')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('标题过短返回 400', async () => {
      const res = await http
        .post('/api/projects')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ ...createPayload, title: '' });

      expect(res.status).toBe(400);
    });

    it('deadline 格式非法返回 400', async () => {
      const res = await http
        .post('/api/projects')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ ...createPayload, deadline: 'not-a-date' });

      expect(res.status).toBe(400);
    });

    it('max_members 超出范围返回 400', async () => {
      const res = await http
        .post('/api/projects')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ ...createPayload, max_members: 100 });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  //  PATCH /api/projects/:id — 修改项目
  // ================================================================
  describe('PATCH /api/projects/:id — 修改项目', () => {
    it('队长可以修改项目', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(makeProject());
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.project.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/projects/1')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ title: '新标题' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('项目已更新');
    });

    it('非队长不能修改项目 — 403', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(makeProject());
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(2),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/projects/1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '想改标题' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('仅队长可操作');
    });

    it('未登录返回 401', async () => {
      const res = await http.patch('/api/projects/1').send({ title: '新标题' });
      expect(res.status).toBe(401);
    });

    it('项目不存在返回 404', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(null);

      const res = await http
        .patch('/api/projects/999')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ title: '新标题' });

      expect(res.status).toBe(404);
    });

    it('有未完成任务时不能关闭项目 — 400', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProject({ status: 'ACTIVE' }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
      });
      prisma.task.count.mockResolvedValueOnce(3);

      const res = await http
        .patch('/api/projects/1')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ status: 'CLOSED' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('未完成');
    });
  });

  // ================================================================
  //  POST /api/projects/:id/apply — 申请加入
  // ================================================================
  describe('POST /api/projects/:id/apply — 申请加入', () => {
    it('成功提交申请', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProject({
          members: [{ user_id: BigInt(1), status: 'APPROVED', is_deleted: false }],
        }),
      );
      // 尚未有申请记录
      prisma.projectMember.findUnique.mockResolvedValueOnce(null);
      prisma.projectMember.create.mockResolvedValueOnce({});

      const res = await http
        .post('/api/projects/1/apply')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ apply_reason: '我想加入' });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('申请已提交');
    });

    it('未登录返回 401', async () => {
      const res = await http.post('/api/projects/1/apply').send({});
      expect(res.status).toBe(401);
    });

    it('项目不在招募期返回 400', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProject({ status: 'ACTIVE' }),
      );

      const res = await http
        .post('/api/projects/1/apply')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('招募');
    });

    it('已满员不能申请 — 400', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProject({
          max_members: 2,
          members: [
            { user_id: BigInt(1), status: 'APPROVED', is_deleted: false },
            { user_id: BigInt(2), status: 'APPROVED', is_deleted: false },
          ],
        }),
      );

      const res = await http
        .post('/api/projects/1/apply')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('满员');
    });

    it('已是成员重复申请返回 409', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProject({
          members: [
            { user_id: BigInt(1), status: 'APPROVED', is_deleted: false },
            { user_id: BigInt(2), status: 'APPROVED', is_deleted: false },
          ],
        }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(2),
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .post('/api/projects/1/apply')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('已是项目成员');
    });
  });

  // ================================================================
  //  PATCH /api/projects/:id/members/:userId — 审批成员
  // ================================================================
  describe('PATCH /api/projects/:id/members/:userId — 审批成员', () => {
    it('队长批准成员', async () => {
      // 验证队长身份
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        is_deleted: false,
      });
      // 目标成员是 PENDING 状态
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(2),
        status: 'PENDING',
        is_deleted: false,
      });
      prisma.projectMember.update.mockResolvedValueOnce({});
      // 查询项目人数（未满员，不触发状态变更）
      prisma.project.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        max_members: 5,
        members: [
          { user_id: BigInt(1), status: 'APPROVED', is_deleted: false },
          { user_id: BigInt(2), status: 'APPROVED', is_deleted: false },
        ],
      });
      prisma.project.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/projects/1/members/2')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('已批准');
    });

    it('队长拒绝成员', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        is_deleted: false,
      });
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(2),
        status: 'PENDING',
        is_deleted: false,
      });
      prisma.projectMember.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/projects/1/members/2')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ status: 'REJECTED' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('已拒绝');
    });

    it('非队长不能审批 — 403', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(2),
        role: 'MEMBER',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/projects/1/members/2')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
    });

    it('已处理过的申请不能重复处理 — 400', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'LEADER',
        is_deleted: false,
      });
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(2),
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/projects/1/members/2')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('已处理');
    });

    it('未登录返回 401', async () => {
      const res = await http
        .patch('/api/projects/1/members/2')
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(401);
    });
  });
});
