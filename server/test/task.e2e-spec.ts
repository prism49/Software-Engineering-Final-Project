/**
 * E2E — 任务接口测试
 *
 * 覆盖：
 *   GET    /api/tasks/:id                     — 任务详情
 *   GET    /api/projects/:id/tasks            — 项目任务列表（?status=）
 *   POST   /api/projects/:id/tasks            — 创建任务（需登录）
 *   PATCH  /api/tasks/:id                     — 更新任务 + 状态流转
 *   DELETE /api/tasks/:id                     — 删除任务（需登录）
 *   PATCH  /api/tasks/:id/review              — 审核任务
 */

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestAppContext, createAuthToken } from './helpers';

describe('Task — 任务接口 (e2e)', () => {
  let app: INestApplication;
  let prisma: TestAppContext['prisma'];
  let jwtService: JwtService;
  let http: request.SuperTest<request.Test>;
  let memberToken: string;
  let otherMemberToken: string;

  const memberUser = { userId: 1, username: 'member1', role: 'STUDENT' as const };
  const otherUser = { userId: 2, username: 'member2', role: 'STUDENT' as const };

  /** 构造任务行 */
  const makeTask = (overrides: any = {}) => ({
    task_id: BigInt(1),
    project_id: BigInt(1),
    creator_id: BigInt(1),
    assignee_id: BigInt(1),
    title: '测试任务',
    description: null,
    weight: 1,
    status: 'TODO',
    due_date: null,
    milestone_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    is_deleted: false,
    project: { project_id: BigInt(1), title: '测试项目' },
    creator: { user_id: BigInt(1), username: 'member1', nickname: '成员1' },
    assignee: { user_id: BigInt(1), username: 'member1', nickname: '成员1' },
    milestone: null,
    ...overrides,
  });

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    jwtService = ctx.jwtService;
    http = ctx.request;

    memberToken = createAuthToken(jwtService, memberUser);
    otherMemberToken = createAuthToken(jwtService, otherUser);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ================================================================
  //  GET /api/tasks/:id — 任务详情
  // ================================================================
  describe('GET /api/tasks/:id — 任务详情', () => {
    it('返回任务完整信息', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(makeTask());

      const res = await http.get('/api/tasks/1');

      expect(res.status).toBe(200);
      expect(res.body.task_id).toBe(1);
      expect(res.body.title).toBe('测试任务');
      expect(res.body.status).toBe('TODO');
      expect(res.body.project.title).toBe('测试项目');
    });

    it('任务不存在返回 404', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(null);

      const res = await http.get('/api/tasks/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('任务不存在');
    });
  });

  // ================================================================
  //  GET /api/projects/:id/tasks — 项目任务列表
  // ================================================================
  describe('GET /api/projects/:id/tasks — 项目任务列表', () => {
    it('返回项目下所有任务', async () => {
      prisma.task.findMany.mockResolvedValueOnce([makeTask()]);

      const res = await http.get('/api/projects/1/tasks');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('支持 ?status= 筛选', async () => {
      prisma.task.findMany.mockResolvedValueOnce([]);

      await http.get('/api/projects/1/tasks?status=DOING');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DOING' }),
        }),
      );
    });

    it('公开接口 — 无需登录', async () => {
      prisma.task.findMany.mockResolvedValueOnce([]);

      const res = await http.get('/api/projects/1/tasks');
      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  //  POST /api/projects/:id/tasks — 创建任务
  // ================================================================
  describe('POST /api/projects/:id/tasks — 创建任务', () => {
    const createPayload = {
      title: '新任务',
      description: '任务描述',
      weight: 2,
      assignee_id: 1,
      due_date: '2026-06-30',
    };

    it('项目成员可以创建任务', async () => {
      // 成员校验通过
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      // 无 milestone_id，跳过里程碑校验
      prisma.task.create.mockResolvedValueOnce({
        task_id: BigInt(10),
        title: '新任务',
        status: 'DOING',
      });

      const res = await http
        .post('/api/projects/1/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(createPayload);

      expect(res.status).toBe(201);
      expect(res.body.task_id).toBe(10);
      expect(res.body.title).toBe('新任务');
      expect(res.body.status).toBe('DOING');
    });

    it('指派执行人时初始状态为 DOING', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.create.mockResolvedValueOnce({
        task_id: BigInt(11),
        title: '指派任务',
        status: 'DOING',
      });

      const res = await http
        .post('/api/projects/1/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '指派任务', assignee_id: 2 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DOING');
    });

    it('未指派执行人时初始状态为 TODO', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.create.mockResolvedValueOnce({
        task_id: BigInt(12),
        title: '未指派',
        status: 'TODO',
      });

      const res = await http
        .post('/api/projects/1/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '未指派' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('TODO');
    });

    it('非项目成员不能创建 — 403', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce(null);

      const res = await http
        .post('/api/projects/1/tasks')
        .set('Authorization', `Bearer ${otherMemberToken}`)
        .send(createPayload);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('你不是该项目成员');
    });

    it('未登录返回 401', async () => {
      const res = await http.post('/api/projects/1/tasks').send(createPayload);
      expect(res.status).toBe(401);
    });

    it('缺少标题返回 400', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .post('/api/projects/1/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  //  PATCH /api/tasks/:id — 更新任务 + 状态流转
  // ================================================================
  describe('PATCH /api/tasks/:id — 更新任务 / 状态流转', () => {
    it('更新任务标题', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(makeTask());
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/tasks/1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '新标题' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('任务已更新');
    });

    it('TODO → DOING 合法（自动认领）', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'TODO', assignee_id: null }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/tasks/1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'DOING' });

      expect(res.status).toBe(200);
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DOING', assignee_id: BigInt(1) }),
        }),
      );
    });

    it('TODO → REVIEW 非法 — 400', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'TODO' }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/tasks/1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'REVIEW' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('不能从');
    });

    it('DOING → REVIEW 合法', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ task_id: BigInt(1), status: 'DOING', assignee_id: BigInt(1) }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/tasks/1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'REVIEW' });

      expect(res.status).toBe(200);
    });

    it('DONE 是终态 — 不能再流转', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'DONE' }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/tasks/1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'DOING' });

      expect(res.status).toBe(400);
    });

    it('未登录返回 401', async () => {
      const res = await http.patch('/api/tasks/1').send({ title: '新标题' });
      expect(res.status).toBe(401);
    });

    it('任务不存在返回 404', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(null);

      const res = await http
        .patch('/api/tasks/999')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '新标题' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  //  DELETE /api/tasks/:id — 删除任务
  // ================================================================
  describe('DELETE /api/tasks/:id — 删除任务', () => {
    it('项目成员可以删除任务', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(makeTask());
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.update.mockResolvedValueOnce({});

      const res = await http
        .delete('/api/tasks/1')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('任务已删除');
    });

    it('非项目成员不能删除 — 403', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(makeTask());
      prisma.projectMember.findUnique.mockResolvedValueOnce(null);

      const res = await http
        .delete('/api/tasks/1')
        .set('Authorization', `Bearer ${otherMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('未登录返回 401', async () => {
      const res = await http.delete('/api/tasks/1');
      expect(res.status).toBe(401);
    });

    it('任务不存在返回 404', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(null);

      const res = await http
        .delete('/api/tasks/999')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  //  PATCH /api/tasks/:id/review — 审核任务
  // ================================================================
  describe('PATCH /api/tasks/:id/review — 审核任务', () => {
    it('审核通过：REVIEW → DONE', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'REVIEW', assignee_id: BigInt(2) }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/tasks/1/review')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ action: 'DONE' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('审核通过');
    });

    it('审核打回：REVIEW → DOING', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'REVIEW', assignee_id: BigInt(2) }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });
      prisma.task.update.mockResolvedValueOnce({});

      const res = await http
        .patch('/api/tasks/1/review')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ action: 'DOING' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('已打回');
    });

    it('执行人不能审核自己的任务 — 403', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'REVIEW', assignee_id: BigInt(1) }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/tasks/1/review')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ action: 'DONE' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('不能审核自己');
    });

    it('非 REVIEW 状态不能审核 — 400', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'DOING' }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/tasks/1/review')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ action: 'DONE' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('不在待审核状态');
    });

    it('未登录返回 401', async () => {
      const res = await http
        .patch('/api/tasks/1/review')
        .send({ action: 'DONE' });
      expect(res.status).toBe(401);
    });

    it('action 枚举值非法返回 400', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(
        makeTask({ status: 'REVIEW', assignee_id: BigInt(2) }),
      );
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: BigInt(1),
        user_id: BigInt(1),
        role: 'MEMBER',
        status: 'APPROVED',
        is_deleted: false,
      });

      const res = await http
        .patch('/api/tasks/1/review')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ action: 'INVALID' });

      expect(res.status).toBe(400);
    });
  });
});
