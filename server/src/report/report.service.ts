import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  /** 图表数据 */
  async charts(projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    if (!project) throw new NotFoundException('项目不存在');
    if (project.status !== 'CLOSED') {
      throw new BadRequestException('项目未关闭，暂无报表数据');
    }

    // 校验所有成员互评完成
    await this.requireAllReviewsDone(projectId);

    // 任务状态分布
    const tasks = await this.prisma.task.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    const taskStatusCount = {
      TODO: tasks.filter((t) => t.status === 'TODO').length,
      DOING: tasks.filter((t) => t.status === 'DOING').length,
      REVIEW: tasks.filter((t) => t.status === 'REVIEW').length,
      DONE: tasks.filter((t) => t.status === 'DONE').length,
    };

    // 成员任务完成统计
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: BigInt(projectId), status: 'APPROVED', is_deleted: false },
      include: { user: { select: { user_id: true, username: true, nickname: true } } },
    });

    const memberTaskStats = members.map((m) => {
      const memberTasks = tasks.filter((t) => t.assignee_id === m.user_id);
      return {
        user_id: Number(m.user_id),
        nickname: m.user.nickname,
        TODO: memberTasks.filter((t) => t.status === 'TODO').length,
        DOING: memberTasks.filter((t) => t.status === 'DOING').length,
        REVIEW: memberTasks.filter((t) => t.status === 'REVIEW').length,
        DONE: memberTasks.filter((t) => t.status === 'DONE').length,
      };
    });

    // 里程碑进度
    const milestones = await this.prisma.milestone.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    const milestoneProgress = milestones.map((m) => ({
      milestone_id: Number(m.milestone_id),
      title: m.title,
      status: m.status,
      due_date: m.due_date,
    }));

    // 贡献度数据（复用算法）
    const maxTasks = Math.max(1, ...memberTaskStats.map((m) => m.DONE));
    const maxWeight = Math.max(
      1,
      ...members.map((m) => {
        return tasks
          .filter((t) => t.assignee_id === m.user_id && t.status === 'DONE')
          .reduce((sum, t) => sum + t.weight, 0);
      }),
    );

    // 互评数据
    const reviews = await this.prisma.peerReview.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });

    const reviewSummary = members.map((m) => {
      const myReviews = reviews.filter((r) => r.target_id === m.user_id);
      const avgScore =
        myReviews.length > 0
          ? Math.round((myReviews.reduce((sum, r) => sum + r.score, 0) / myReviews.length) * 100) / 100
          : 0;
      return {
        user_id: Number(m.user_id),
        nickname: m.user.nickname,
        avg_score: avgScore,
        count: myReviews.length,
      };
    });

    const contributionData = members.map((m) => {
      const done = tasks
        .filter((t) => t.assignee_id === m.user_id && t.status === 'DONE');
      const totalW = done.reduce((sum, t) => sum + t.weight, 0);
      const myReview = reviewSummary.find((r) => r.user_id === Number(m.user_id));
      const score = myReview?.avg_score ?? 0;

      const taskScore = (done.length / maxTasks) * 100;
      const weightScore = (totalW / maxWeight) * 100;
      const reviewScore = (score / 5) * 100;

      const raw = taskScore * 0.4 + weightScore * 0.3 + reviewScore * 0.3;

      return {
        user_id: Number(m.user_id),
        nickname: m.user.nickname,
        tasks_done: done.length,
        total_weight: totalW,
        avg_score: score,
        raw,
      };
    });

    const totalRaw = contributionData.reduce((sum, m) => sum + m.raw, 0) || 1;
    const contributions = contributionData.map((m) => ({
      user_id: m.user_id,
      nickname: m.nickname,
      tasks_done: m.tasks_done,
      total_weight: m.total_weight,
      avg_score: m.avg_score,
      contribution: Math.round((m.raw / totalRaw) * 100 * 10) / 10,
    }));

    return { taskStatusCount, memberTaskStats, milestoneProgress, reviewSummary, contributions };
  }

  /** Excel 导出 */
  async exportExcel(projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    if (!project) throw new NotFoundException('项目不存在');
    if (project.status !== 'CLOSED') {
      throw new BadRequestException('项目未关闭，暂无报表数据');
    }

    // 校验所有成员互评完成
    await this.requireAllReviewsDone(projectId);

    // 成员列表
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: BigInt(projectId), status: 'APPROVED', is_deleted: false },
      include: { user: { select: { user_id: true, nickname: true } } },
    });

    // 任务列表
    const tasks = await this.prisma.task.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
      include: {
        assignee: { select: { nickname: true } },
        milestone: { select: { title: true } },
      },
    });

    // 互评
    const reviews = await this.prisma.peerReview.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
      include: {
        reviewer: { select: { nickname: true } },
        target: { select: { nickname: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();

    // Sheet 1：任务清单
    const sheet1 = workbook.addWorksheet('任务清单');
    sheet1.columns = [
      { header: '标题', key: 'title', width: 25 },
      { header: '状态', key: 'status', width: 10 },
      { header: '执行人', key: 'assignee', width: 12 },
      { header: '里程碑', key: 'milestone', width: 15 },
      { header: '截止日期', key: 'due_date', width: 14 },
    ];
    tasks.forEach((t) => {
      sheet1.addRow({
        title: t.title,
        status: t.status,
        assignee: t.assignee?.nickname ?? '',
        milestone: t.milestone?.title ?? '',
        due_date: t.due_date ? new Date(t.due_date).toLocaleDateString('zh-CN') : '',
      });
    });

    // Sheet 2：贡献度
    const sheet2 = workbook.addWorksheet('贡献度');
    sheet2.columns = [
      { header: '成员', key: 'nickname', width: 12 },
      { header: '完成任务数', key: 'tasks_done', width: 12 },
      { header: '任务权重和', key: 'total_weight', width: 12 },
      { header: '互评均分', key: 'avg_score', width: 10 },
      { header: '贡献度(%)', key: 'contribution', width: 12 },
    ];

    // 计算贡献度
    const maxTasks = Math.max(1, ...members.map((m) => tasks.filter((t) => t.assignee_id === m.user_id && t.status === 'DONE').length));
    const maxWeight = Math.max(1, ...members.map((m) => tasks.filter((t) => t.assignee_id === m.user_id && t.status === 'DONE').reduce((s, t) => s + t.weight, 0)));
    const maxScore = Math.max(5, ...members.map((m) => {
      const rs = reviews.filter((r) => r.target_id === m.user_id);
      return rs.length > 0 ? rs.reduce((s, r) => s + r.score, 0) / rs.length : 0;
    }));

    const contribRows = members.map((m) => {
      const done = tasks.filter((t) => t.assignee_id === m.user_id && t.status === 'DONE');
      const totalW = done.reduce((s, t) => s + t.weight, 0);
      const rs = reviews.filter((r) => r.target_id === m.user_id);
      const avgS = rs.length > 0 ? rs.reduce((s, r) => s + r.score, 0) / rs.length : 0;
      const raw = (done.length / maxTasks) * 40 + (totalW / maxWeight) * 30 + (avgS / maxScore) * 30;
      return { nickname: m.user.nickname, tasks_done: done.length, total_weight: totalW, avg_score: Math.round(avgS * 100) / 100, raw };
    });

    const totalRaw = contribRows.reduce((s, r) => s + r.raw, 0) || 1;
    contribRows.forEach((r) => {
      sheet2.addRow({
        nickname: r.nickname,
        tasks_done: r.tasks_done,
        total_weight: r.total_weight,
        avg_score: r.avg_score,
        contribution: Math.round((r.raw / totalRaw) * 1000) / 10,
      });
    });

    // Sheet 3：互评明细
    const sheet3 = workbook.addWorksheet('互评明细');
    sheet3.columns = [
      { header: '评分人', key: 'reviewer', width: 12 },
      { header: '被评人', key: 'target', width: 12 },
      { header: '评分', key: 'score', width: 8 },
      { header: '评语', key: 'content', width: 30 },
      { header: '时间', key: 'time', width: 20 },
    ];
    reviews.forEach((r) => {
      sheet3.addRow({
        reviewer: r.reviewer.nickname,
        target: r.target.nickname,
        score: r.score,
        content: r.content ?? '',
        time: new Date(r.created_at).toLocaleString('zh-CN'),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /** 校验所有成员已完成互评 */
  private async requireAllReviewsDone(projectId: number) {
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: BigInt(projectId), status: 'APPROVED', is_deleted: false },
      include: { user: { select: { nickname: true } } },
    });

    if (members.length <= 1) return; // 只有一人无需互评

    const reviews = await this.prisma.peerReview.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });

    const notDone: string[] = [];
    for (const m of members) {
      const reviewedCount = reviews.filter((r) => r.reviewer_id === m.user_id).length;
      if (reviewedCount < members.length - 1) {
        notDone.push(m.user.nickname);
      }
    }

    if (notDone.length > 0) {
      throw new BadRequestException(
        `互评尚未完成，以下成员还未给所有人评分：${notDone.join('、')}`,
      );
    }
  }
}
