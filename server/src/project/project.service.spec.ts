import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma } from '../prisma/__mocks__/prisma.service.mock';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('ProjectService — 权限判断 & 项目状态机', () => {
  let service: ProjectService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const makeProject = (overrides: any = {}) => ({
    project_id: 1n,
    leader_id: 1n,
    title: '测试项目',
    description: null,
    max_members: 5,
    status: 'RECRUITING',
    deadline: new Date('2026-12-31'),
    created_at: new Date(),
    updated_at: new Date(),
    is_deleted: false,
    members: [],
    milestones: [],
    project_required_tags: [],
    _count: { tasks: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    const mockPrisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================
  //  权限判断 — requireLeader
  // ================================================================
  describe('权限判断 requireLeader（仅队长可操作）', () => {
    it('队长可以更新项目', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject());
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 1n,
        role: 'LEADER', // 队长
      });

      // status 不变化，跳过状态流转校验
      const result = await service.update(1, 1, { title: '新标题' });
      expect(result.message).toBe('项目已更新');
    });

    it('普通成员不能更新项目', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject());
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 2n,
        role: 'MEMBER', // 普通成员
      });

      await expect(service.update(1, 2, { title: '新标题' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('不存在于项目中的用户不能更新项目', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject());
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.update(1, 3, { title: '新标题' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('非队长不能审批成员', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: 1n,
        user_id: 2n,
        role: 'MEMBER',
      });

      await expect(
        service.approveMember(1, 3, 2, { status: 'APPROVED' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ================================================================
  //  权限判断 — 申请加入项目
  // ================================================================
  describe('权限判断 — apply() 申请加入', () => {
    it('项目不存在抛 NotFound', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.apply(999, 1, {})).rejects.toThrow(NotFoundException);
    });

    it('项目不在招募阶段不能申请', async () => {
      prisma.project.findFirst.mockResolvedValue(
        makeProject({ status: 'ACTIVE' }),
      );
      await expect(service.apply(1, 2, {})).rejects.toThrow(BadRequestException);
    });

    it('已满员的项目不能申请', async () => {
      prisma.project.findFirst.mockResolvedValue(
        makeProject({
          max_members: 2,
          members: [
            { user_id: 1n, status: 'APPROVED', is_deleted: false },
            { user_id: 2n, status: 'APPROVED', is_deleted: false },
          ],
        }),
      );
      await expect(service.apply(1, 3, {})).rejects.toThrow(BadRequestException);
    });

    it('已是成员时不能重复申请', async () => {
      prisma.project.findFirst.mockResolvedValue(
        makeProject({
          members: [{ user_id: 1n, status: 'APPROVED', is_deleted: false }],
        }),
      );
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 1n,
        status: 'APPROVED',
        is_deleted: false,
      });

      await expect(service.apply(1, 1, {})).rejects.toThrow(ConflictException);
    });

    it('已提交 PENDING 申请等待中', async () => {
      prisma.project.findFirst.mockResolvedValue(
        makeProject({
          members: [],
        }),
      );
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 2n,
        status: 'PENDING',
        is_deleted: false,
      });

      await expect(service.apply(1, 2, {})).rejects.toThrow(ConflictException);
    });

    it('被拒绝后可以重新申请', async () => {
      prisma.project.findFirst.mockResolvedValue(
        makeProject({
          members: [],
        }),
      );
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n,
        user_id: 2n,
        status: 'REJECTED',
        is_deleted: false,
      });
      prisma.projectMember.update.mockResolvedValue({});

      const result = await service.apply(1, 2, { apply_reason: '再试一次' });
      expect(result.message).toBe('申请已重新提交');
      expect(prisma.projectMember.update).toHaveBeenCalled();
    });
  });

  // ================================================================
  //  项目状态机
  // ================================================================
  describe('项目状态流转', () => {
    it('CLOSED 项目不能修改状态', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject({ status: 'CLOSED' }));
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });

      await expect(
        service.update(1, 1, { status: 'RECRUITING' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('有未完成任务时不能关闭项目', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject({ status: 'ACTIVE' }));
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });
      prisma.task.count.mockResolvedValue(3);

      await expect(
        service.update(1, 1, { status: 'CLOSED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('无未完成任务时可以关闭项目', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject({ status: 'ACTIVE' }));
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });
      prisma.task.count.mockResolvedValue(0);
      prisma.project.update.mockResolvedValue({});

      const result = await service.update(1, 1, { status: 'CLOSED' });
      expect(result.message).toBe('项目已更新');
    });

    it('RECRUITING → ACTIVE 合法', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject({ status: 'RECRUITING' }));
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });
      prisma.project.update.mockResolvedValue({});

      const result = await service.update(1, 1, { status: 'ACTIVE' });
      expect(result.message).toBe('项目已更新');
    });

    it('ACTIVE → RECRUITING 合法（重新招募）', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject({ status: 'ACTIVE' }));
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });
      prisma.project.update.mockResolvedValue({});

      const result = await service.update(1, 1, { status: 'RECRUITING' });
      expect(result.message).toBe('项目已更新');
    });

    it('非法状态路径抛 BadRequest', async () => {
      prisma.project.findFirst.mockResolvedValue(makeProject({ status: 'RECRUITING' }));
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });

      await expect(
        service.update(1, 1, { status: 'DONE' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ================================================================
  //  审批成员 — 满员自动 ACTIVE
  // ================================================================
  describe('approveMember — 审批成员', () => {
    it('批准成员后满员则项目自动 ACTIVE', async () => {
      // 验证队长身份
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });

      // target 是 PENDING 状态
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: 1n, user_id: 2n, status: 'PENDING', is_deleted: false,
      });

      prisma.projectMember.update.mockResolvedValue({});

      // 批准后查项目人数：满员
      prisma.project.findUnique.mockResolvedValue({
        project_id: 1n,
        max_members: 2,
        members: [
          { user_id: 1n, status: 'APPROVED', is_deleted: false },
          { user_id: 2n, status: 'APPROVED', is_deleted: false },
        ],
      });
      prisma.project.update.mockResolvedValue({});

      const result = await service.approveMember(1, 2, 1, {
        status: 'APPROVED',
      });
      expect(result.message).toBe('已批准');
      // 应触发项目状态自动更新为 ACTIVE
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: 1n },
          data: { status: 'ACTIVE' },
        }),
      );
    });

    it('已处理过的申请不能重复处理', async () => {
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: 1n, user_id: 1n, role: 'LEADER',
      });
      prisma.projectMember.findUnique.mockResolvedValueOnce({
        project_id: 1n, user_id: 2n, status: 'APPROVED', is_deleted: false,
      });

      await expect(
        service.approveMember(1, 2, 1, { status: 'APPROVED' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ================================================================
  //  边缘情况 — 项目不存在、已删除
  // ================================================================
  describe('边缘情况', () => {
    it('查询不存在的项目抛 NotFound', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('更新不存在的项目抛 NotFound', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.update(999, 1, { title: '新' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});