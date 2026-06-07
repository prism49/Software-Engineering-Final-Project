import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma } from '../prisma/__mocks__/prisma.service.mock';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('TaskService — 状态机逻辑', () => {
  let service: TaskService;
  let prisma: ReturnType<typeof createMockPrisma>;

  // 一个典型的任务对象（数据库行）
  const makeTask = (overrides: any = {}) => ({
    task_id: 1n,
    project_id: 1n,
    creator_id: 1n,
    assignee_id: 2n,
    title: '测试任务',
    description: null,
    weight: 1,
    status: 'TODO',
    due_date: null,
    milestone_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    is_deleted: false,
    ...overrides,
  });

  beforeEach(async () => {
    const mockPrisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    prisma = module.get(PrismaService);

    // 默认：成员校验通过
    prisma.projectMember.findUnique.mockResolvedValue({
      project_id: 1n,
      user_id: 1n,
      role: 'MEMBER',
      status: 'APPROVED',
      is_deleted: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================
  //  状态流转 — validateTransition（通过 update 方法间接测试）
  // ================================================================

  describe('状态流转 VALID_TRANSITIONS', () => {
    // 合法：TODO → DOING（带指派人）
    it('TODO → DOING 合法，且自动认领当前用户', async () => {
      const task = makeTask({ task_id: 1n, status: 'TODO', assignee_id: null });
      prisma.task.findFirst.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({});

      await service.update(1, 1, { status: 'DOING' });
      // 未传 assignee_id 时自动设为当前用户
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DOING',
            assignee_id: 1n,
          }),
        }),
      );
    });

    // 合法：TODO → DOING（显式指派人）
    it('TODO → DOING 合法，显式传入 assignee_id', async () => {
      const task = makeTask({ task_id: 1n, status: 'TODO', assignee_id: null });
      prisma.task.findFirst.mockResolvedValue(task);

      await service.update(1, 1, { status: 'DOING', assignee_id: 3 });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DOING', assignee_id: 3n }),
        }),
      );
    });

    // 非法：TODO → REVIEW（越级）
    it('TODO → REVIEW 非法', async () => {
      const task = makeTask({ task_id: 1n, status: 'TODO' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.update(1, 1, { status: 'REVIEW' })).rejects.toThrow(
        BadRequestException,
      );
    });

    // 非法：TODO → DONE（越级）
    it('TODO → DONE 非法', async () => {
      const task = makeTask({ task_id: 1n, status: 'TODO' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.update(1, 1, { status: 'DONE' })).rejects.toThrow(
        BadRequestException,
      );
    });

    // 合法：DOING → REVIEW
    it('DOING → REVIEW 合法（执行人本人提交）', async () => {
      const task = makeTask({ task_id: 1n, status: 'DOING', assignee_id: 1n });
      prisma.task.findFirst.mockResolvedValue(task);

      await service.update(1, 1, { status: 'REVIEW' });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REVIEW' }),
        }),
      );
    });

    // 注意：validateTransition 中 DOING→REVIEW 仅校验 assignee_id 是否变化，
    // 真正的"执行人检查"在 review() 方法中实现
    it('DOING → REVIEW 合法（非执行人也可通过 update 提交，审核阶段再拦截）', async () => {
      const task = makeTask({ task_id: 1n, status: 'DOING', assignee_id: 2n });
      prisma.task.findFirst.mockResolvedValue(task);

      // update 方法不校验调用者是否是执行人，所以此处不抛异常
      await expect(
        service.update(1, 1, { status: 'REVIEW' }),
      ).resolves.toEqual({ message: '任务已更新' });
    });

    // 非法：DOING → TODO（回退）
    it('DOING → TODO 非法（状态机不允许回退）', async () => {
      const task = makeTask({ task_id: 1n, status: 'DOING' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.update(1, 1, { status: 'TODO' })).rejects.toThrow(
        BadRequestException,
      );
    });

    // 非法：DOING → DONE（跳过审核）
    it('DOING → DONE 非法（跳过 REVIEW 阶段）', async () => {
      const task = makeTask({ task_id: 1n, status: 'DOING' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.update(1, 1, { status: 'DONE' })).rejects.toThrow(
        BadRequestException,
      );
    });

    // 合法：REVIEW → DOING（打回）
    it('REVIEW → DOING 合法（审核打回）', async () => {
      const task = makeTask({ task_id: 1n, status: 'REVIEW', assignee_id: 2n });
      prisma.task.findFirst.mockResolvedValue(task);

      await service.update(1, 1, { status: 'DOING' });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DOING' }),
        }),
      );
    });

    // 非法：REVIEW → TODO（回退）
    it('REVIEW → TODO 非法', async () => {
      const task = makeTask({ task_id: 1n, status: 'REVIEW' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.update(1, 1, { status: 'TODO' })).rejects.toThrow(
        BadRequestException,
      );
    });

    // 非法：DONE → 任意状态（终态不可流转）
    it('DONE 是终态，不能流转到任何状态', async () => {
      const task = makeTask({ task_id: 1n, status: 'DONE' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.update(1, 1, { status: 'DOING' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(1, 1, { status: 'REVIEW' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(1, 1, { status: 'TODO' })).rejects.toThrow(
        BadRequestException,
      );
    });

    // 未变更状态时不做校验
    it('status 未变化时不触发状态校验', async () => {
      const task = makeTask({ task_id: 1n, status: 'TODO' });
      prisma.task.findFirst.mockResolvedValue(task);

      // 只更新标题，不触发状态校验
      await service.update(1, 1, { title: '新标题' });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: '新标题' }),
        }),
      );
    });
  });

  // ================================================================
  //  Review 方法 — 专门用于 REVIEW 阶段的审核
  // ================================================================
  describe('review() — 审核功能', () => {
    it('审核通过：REVIEW → DONE', async () => {
      const task = makeTask({ task_id: 1n, status: 'REVIEW', assignee_id: 2n });
      prisma.task.findFirst.mockResolvedValue(task);

      const result = await service.review(1, 1, { action: 'DONE' });
      expect(result.message).toBe('审核通过');
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DONE' },
        }),
      );
    });

    it('审核打回：REVIEW → DOING', async () => {
      const task = makeTask({ task_id: 1n, status: 'REVIEW', assignee_id: 2n });
      prisma.task.findFirst.mockResolvedValue(task);

      const result = await service.review(1, 1, { action: 'DOING' });
      expect(result.message).toBe('已打回');
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DOING' },
        }),
      );
    });

    it('非 REVIEW 状态不能审核', async () => {
      const task = makeTask({ task_id: 1n, status: 'DOING' });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.review(1, 1, { action: 'DONE' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('执行人不能审核自己的任务', async () => {
      const task = makeTask({ task_id: 1n, status: 'REVIEW', assignee_id: 1n });
      prisma.task.findFirst.mockResolvedValue(task);

      await expect(service.review(1, 1, { action: 'DONE' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('审核不存在的任务抛 NotFound', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.review(999, 1, { action: 'DONE' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  //  权限判断 — requireMember
  // ================================================================
  describe('权限判断 requireMember', () => {
    it('非项目成员不能创建任务', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);
      const dto = { title: '任务', assignee_id: 1 };

      await expect(service.create(1, 1, dto as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('已删除的成员无法操作', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 1n,
        status: 'APPROVED',
        is_deleted: true,
      });

      await expect(service.create(1, 1, { title: '任务' } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('未批准的成员无法操作', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 1n,
        status: 'PENDING',
        is_deleted: false,
      });

      await expect(service.create(1, 1, { title: '任务' } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ================================================================
  //  工具逻辑 — 创建任务时的自动状态
  // ================================================================
  describe('创建任务时的自动状态', () => {
    it('指派执行人时初始状态为 DOING', async () => {
      prisma.milestone.findFirst.mockResolvedValue(null); // 无里程碑校验
      const dto = { title: '新任务', assignee_id: 2 };

      prisma.task.create.mockResolvedValue({
        task_id: 10n,
        title: '新任务',
        status: 'DOING',
      });

      const result = await service.create(1, 1, dto as any);
      expect(result.status).toBe('DOING');
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DOING' }),
        }),
      );
    });

    it('未指派执行人时初始状态为 TODO', async () => {
      const dto = { title: '新任务' };

      prisma.task.create.mockResolvedValue({
        task_id: 11n,
        title: '新任务',
        status: 'TODO',
      });

      const result = await service.create(1, 1, dto as any);
      expect(result.status).toBe('TODO');
    });

    it('无内容的任务不触发里程碑校验', async () => {
      prisma.milestone.findFirst.mockResolvedValue(null);
      const dto = { title: '无里程碑任务' };

      prisma.task.create.mockResolvedValue({
        task_id: 12n,
        title: '无里程碑任务',
        status: 'TODO',
      });

      // 不传 milestone_id 和 due_date，不应查询里程碑
      await service.create(1, 1, dto as any);
      expect(prisma.milestone.findFirst).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  //  边缘情况 — 任务不存在、已删除等
  // ================================================================
  describe('边缘情况', () => {
    it('更新不存在的任务抛 NotFound', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.update(999, 1, { title: '新' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('查询不存在的任务抛 NotFound', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('删除不存在的任务抛 NotFound', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.delete(999, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
