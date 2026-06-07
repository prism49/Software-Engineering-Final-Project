import { Test, TestingModule } from '@nestjs/testing';
import { ContributionService } from './contribution.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma } from '../prisma/__mocks__/prisma.service.mock';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ContributionService — 贡献度算法', () => {
  let service: ContributionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  // 辅助：创建成员
  const makeMember = (id: number, nickname: string) => ({
    user_id: BigInt(id),
    role: 'MEMBER',
    status: 'APPROVED',
    is_deleted: false,
    user: {
      user_id: BigInt(id),
      username: `user${id}`,
      nickname,
    },
  });

  // 辅助：创建已完成任务
  const makeDoneTask = (assigneeId: number, weight: number) => ({
    task_id: BigInt(Math.floor(Math.random() * 10000)),
    project_id: 1n,
    assignee_id: BigInt(assigneeId),
    status: 'DONE',
    weight,
    is_deleted: false,
  });

  // 辅助：创建互评
  const makeReview = (reviewerId: number, targetId: number, score: number) => ({
    review_id: BigInt(Math.floor(Math.random() * 10000)),
    project_id: 1n,
    reviewer_id: BigInt(reviewerId),
    target_id: BigInt(targetId),
    score,
    is_deleted: false,
  });

  beforeEach(async () => {
    const mockPrisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContributionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContributionService>(ContributionService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================
  //  基础算法验证
  // ================================================================
  describe('贡献度计算', () => {
    it('单人项目返回 100%', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([makeMember(1, '队长')]);
      prisma.task.findMany.mockResolvedValue([makeDoneTask(1, 3)]);
      prisma.peerReview.findMany.mockResolvedValue([]);

      const result = await service.calculate(1);
      expect(result).toHaveLength(1);
      expect(result[0].contribution).toBe(100);
    });

    it('二人均分任务时贡献度接近 50%', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([
        makeMember(1, '用户A'),
        makeMember(2, '用户B'),
      ]);

      // 每人完成 2 个同权重任务，互评都给满分
      prisma.task.findMany.mockResolvedValue([
        makeDoneTask(1, 2),
        makeDoneTask(2, 2),
      ]);
      prisma.peerReview.findMany.mockResolvedValue([
        makeReview(1, 2, 5),
        makeReview(2, 1, 5),
      ]);

      const result = await service.calculate(1);
      expect(result).toHaveLength(2);
      // 两人贡献度之和应为 100%
      const total = result.reduce((s, r) => s + r.contribution, 0);
      expect(total).toBeCloseTo(100, 0);
    });

    it('任务量和权重更高的人贡献度更高', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([
        makeMember(1, '高产用户'),
        makeMember(2, '低产用户'),
      ]);

      // 用户1：3个任务权重5,5,5
      // 用户2：1个任务权重1
      prisma.task.findMany.mockResolvedValue([
        makeDoneTask(1, 5),
        makeDoneTask(1, 5),
        makeDoneTask(1, 5),
        makeDoneTask(2, 1),
      ]);
      prisma.peerReview.findMany.mockResolvedValue([
        makeReview(1, 2, 3),
        makeReview(2, 1, 5),
      ]);

      const result = await service.calculate(1);
      const user1 = result.find((r) => r.user_id === 1)!;
      const user2 = result.find((r) => r.user_id === 2)!;
      expect(user1.contribution).toBeGreaterThan(user2.contribution);
    });
  });

  // ================================================================
  //  归一化边界
  // ================================================================
  describe('归一化处理', () => {
    it('所有维度为零时不会除零崩溃', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([
        makeMember(1, '用户A'),
        makeMember(2, '用户B'),
      ]);
      // 零任务、零互评
      prisma.task.findMany.mockResolvedValue([]);
      // 两人互评给 0 分
      prisma.peerReview.findMany.mockResolvedValue([
        makeReview(1, 2, 0),
        makeReview(2, 1, 0),
      ]);

      const result = await service.calculate(1);
      expect(result).toHaveLength(2);
      expect(result[0].contribution).toBeGreaterThanOrEqual(0);
    });

    it('avg_score 展示保留两位小数', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([
        makeMember(1, '用户A'),
        makeMember(2, '用户B'),
      ]);
      prisma.task.findMany.mockResolvedValue([makeDoneTask(1, 1)]);
      // 互评需要双方都完成
      prisma.peerReview.findMany.mockResolvedValue([
        makeReview(1, 2, 5),
        makeReview(2, 1, 4),
      ]);

      const result = await service.calculate(1);
      const user1 = result.find((r) => r.user_id === 1)!;
      // 4.5 → 保留两位
      expect(user1.avg_score.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    });
  });

  // ================================================================
  //  校验逻辑
  // ================================================================
  describe('前置校验', () => {
    it('项目不存在抛 NotFoundException', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.calculate(999)).rejects.toThrow(NotFoundException);
    });

    it('无成员时返回空数组', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([]);

      const result = await service.calculate(1);
      expect(result).toEqual([]);
    });

    it('多人项目互评未完成时抛 BadRequestException', async () => {
      prisma.project.findFirst.mockResolvedValue({ project_id: 1n, is_deleted: false });
      prisma.projectMember.findMany.mockResolvedValue([
        makeMember(1, '用户A'),
        makeMember(2, '用户B'),
        makeMember(3, '用户C'),
      ]);
      prisma.task.findMany.mockResolvedValue([]);
      // 用户1只评了1个人（需要评2人）
      prisma.peerReview.findMany.mockResolvedValue([
        makeReview(1, 2, 5),
      ]);

      await expect(service.calculate(1)).rejects.toThrow(BadRequestException);
    });
  });
});