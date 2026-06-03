import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContributionService {
  constructor(private prisma: PrismaService) {}

  async calculate(projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    if (!project) throw new NotFoundException('项目不存在');

    // 获取已批准成员
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: BigInt(projectId), status: 'APPROVED', is_deleted: false },
      include: { user: { select: { user_id: true, username: true, nickname: true } } },
    });

    if (members.length === 0) return [];

    // 获取所有 DONE 任务
    const doneTasks = await this.prisma.task.findMany({
      where: { project_id: BigInt(projectId), status: 'DONE', is_deleted: false },
    });

    // 获取所有互评
    const reviews = await this.prisma.peerReview.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });

    // 数据不足时报错
    // 校验所有成员互评完成
    if (members.length > 1) {
      const notDone: string[] = [];
      for (const m of members) {
        const reviewedCount = reviews.filter((r) => r.reviewer_id === m.user_id).length;
        const expected = members.length - 1; // 需要评其他所有人
        if (reviewedCount < expected) {
          notDone.push(m.user.nickname);
        }
      }
      if (notDone.length > 0) {
        throw new BadRequestException(
          `互评尚未完成，以下成员还未给所有人评分：${notDone.join('、')}`,
        );
      }
    }


    // 为每个成员计算原始值
    const memberStats = members.map((m) => {
      const userId = m.user_id;

      const myTasks = doneTasks.filter((t) => t.assignee_id === userId);
      const tasksDone = myTasks.length;
      const totalWeight = myTasks.reduce((sum, t) => sum + t.weight, 0);

      const myReviews = reviews.filter((r) => r.target_id === userId);
      const avgScore =
        myReviews.length > 0
          ? myReviews.reduce((sum, r) => sum + r.score, 0) / myReviews.length
          : 0;

      return {
        user_id: Number(userId),
        username: m.user.username,
        nickname: m.user.nickname,
        tasks_done: tasksDone,
        total_weight: totalWeight,
        avg_score: Math.round(avgScore * 100) / 100,
      };
    });

    // 各维度最大值
    const maxTasks = Math.max(1, ...memberStats.map((m) => m.tasks_done));
    const maxWeight = Math.max(1, ...memberStats.map((m) => m.total_weight));
    const maxScore = Math.max(5, ...memberStats.map((m) => m.avg_score)); // at least 5 for normalization

    // 归一化 + 加权
    const weighted = memberStats.map((m) => {
      const taskScore = (m.tasks_done / maxTasks) * 100; // 0-100
      const weightScore = (m.total_weight / maxWeight) * 100; // 0-100
      const reviewScore = (m.avg_score / maxScore) * 100; // 0-100

      const raw = taskScore * 0.4 + weightScore * 0.3 + reviewScore * 0.3;
      return { ...m, raw };
    });

    // 归一化为百分比
    const totalRaw = weighted.reduce((sum, m) => sum + m.raw, 0) || 1;

    return weighted
      .map((m) => ({
        user_id: m.user_id,
        username: m.username,
        nickname: m.nickname,
        tasks_done: m.tasks_done,
        total_weight: m.total_weight,
        avg_score: m.avg_score,
        contribution: Math.round((m.raw / totalRaw) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.contribution - a.contribution);
  }
}
