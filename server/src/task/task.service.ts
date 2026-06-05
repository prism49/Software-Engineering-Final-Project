import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReviewTaskDto } from './dto/review-task.dto';

// 状态机：定义每个状态的合法下一状态
const VALID_TRANSITIONS: Record<string, string[]> = {
  TODO: ['DOING'],
  DOING: ['REVIEW'],
  REVIEW: ['DONE', 'DOING'],
  DONE: [], // 终态不可流转
};

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  /** 校验用户是否为项目成员 */
  private async requireMember(projectId: bigint, userId: number) {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: BigInt(userId),
        },
      },
    });
    if (!member || member.is_deleted || member.status !== 'APPROVED') {
      throw new ForbiddenException('你不是该项目成员');
    }
    return member;
  }

  /** 获取项目下的所有任务 */
  async findByProject(projectId: number, status?: string) {
    const where: any = {
      project_id: BigInt(projectId),
      is_deleted: false,
    };
    if (status) where.status = status;

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        creator: { select: { user_id: true, username: true, nickname: true } },
        assignee: { select: { user_id: true, username: true, nickname: true } },
        milestone: { select: { milestone_id: true, title: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return tasks.map((t) => ({
      task_id: Number(t.task_id),
      project_id: Number(t.project_id),
      title: t.title,
      description: t.description,
      status: t.status,
      weight: t.weight,
      due_date: t.due_date,
      milestone: t.milestone
        ? { milestone_id: Number(t.milestone.milestone_id), title: t.milestone.title }
        : null,
      creator: { user_id: Number(t.creator.user_id), username: t.creator.username, nickname: t.creator.nickname },
      assignee: t.assignee
        ? { user_id: Number(t.assignee.user_id), username: t.assignee.username, nickname: t.assignee.nickname }
        : null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_overdue:
        t.due_date != null &&
        new Date(t.due_date) < new Date() &&
        t.status !== 'DONE',
    }));
  }

  /** 任务详情 */
  async findOne(taskId: number) {
    const t = await this.prisma.task.findFirst({
      where: { task_id: BigInt(taskId), is_deleted: false },
      include: {
        project: { select: { project_id: true, title: true } },
        creator: { select: { user_id: true, username: true, nickname: true } },
        assignee: { select: { user_id: true, username: true, nickname: true } },
        milestone: { select: { milestone_id: true, title: true } },
      },
    });

    if (!t) throw new NotFoundException('任务不存在');

    return {
      task_id: Number(t.task_id),
      project: { project_id: Number(t.project.project_id), title: t.project.title },
      title: t.title,
      description: t.description,
      status: t.status,
      weight: t.weight,
      due_date: t.due_date,
      milestone: t.milestone
        ? { milestone_id: Number(t.milestone.milestone_id), title: t.milestone.title }
        : null,
      creator: { user_id: Number(t.creator.user_id), username: t.creator.username, nickname: t.creator.nickname },
      assignee: t.assignee
        ? { user_id: Number(t.assignee.user_id), username: t.assignee.username, nickname: t.assignee.nickname }
        : null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_overdue:
        t.due_date != null &&
        new Date(t.due_date) < new Date() &&
        t.status !== 'DONE',
    };
  }

  /** 创建任务 */
  async create(projectId: number, userId: number, dto: CreateTaskDto) {
    await this.requireMember(BigInt(projectId), userId);

    // 校验任务截止时间 <= 里程碑截止时间
    if (dto.milestone_id && dto.due_date) {
      await this.validateDueBeforeMilestone(dto.milestone_id, dto.due_date);
    }

    const task = await this.prisma.task.create({
      data: {
        project_id: BigInt(projectId),
        creator_id: BigInt(userId),
        title: dto.title,
        description: dto.description ?? null,
        milestone_id: dto.milestone_id ? BigInt(dto.milestone_id) : null,
        assignee_id: dto.assignee_id ? BigInt(dto.assignee_id) : null,
        weight: dto.weight ?? 1,
        due_date: dto.due_date ? new Date(dto.due_date) : null,
        status: dto.assignee_id ? 'DOING' : 'TODO', // 指派了人就直接 DOING
      },
    });

    return { task_id: Number(task.task_id), title: task.title, status: task.status };
  }

  /** 软删除任务 */
  async delete(taskId: number, userId: number) {
    const task = await this.prisma.task.findFirst({
      where: { task_id: BigInt(taskId), is_deleted: false },
    });
    if (!task) throw new NotFoundException('任务不存在');

    await this.requireMember(BigInt(task.project_id), userId);

    await this.prisma.task.update({
      where: { task_id: BigInt(taskId) },
      data: { is_deleted: true },
    });

    return { message: '任务已删除' };
  }

  /** 更新任务（标题/描述/指派人/权重）+ 状态流转 */
  async update(taskId: number, userId: number, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { task_id: BigInt(taskId), is_deleted: false },
    });
    if (!task) throw new NotFoundException('任务不存在');

    const operator = await this.requireMember(BigInt(task.project_id), userId);

    // 校验任务截止时间 <= 里程碑截止时间
    const effectiveMilestoneId = dto.milestone_id ?? Number(task.milestone_id ?? 0);
    const effectiveDueDate = dto.due_date ?? (task.due_date ? new Date(task.due_date).toISOString() : undefined);
    if (effectiveMilestoneId && effectiveDueDate) {
      await this.validateDueBeforeMilestone(effectiveMilestoneId, effectiveDueDate);
    }

    // 状态变更时自动认领：TODO → DOING 且未传 assignee_id 则自动设为当前用户
    if (dto.status === 'DOING' && task.status === 'TODO' && dto.assignee_id === undefined) {
      dto.assignee_id = userId;
    }

    // 状态变更时需要校验
    if (dto.status && dto.status !== task.status) {
      this.validateTransition(task.status, dto.status, task, dto.assignee_id);
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.assignee_id !== undefined) data.assignee_id = BigInt(dto.assignee_id);
    if (dto.milestone_id !== undefined)
      data.milestone_id = dto.milestone_id ? BigInt(dto.milestone_id) : null;
    if (dto.due_date !== undefined) data.due_date = new Date(dto.due_date);

    await this.prisma.task.update({
      where: { task_id: BigInt(taskId) },
      data,
    });

    return { message: '任务已更新' };
  }

  /** 审核任务（Review → Done / 打回 Doing） */
  async review(taskId: number, userId: number, dto: ReviewTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { task_id: BigInt(taskId), is_deleted: false },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.status !== 'REVIEW') {
      throw new BadRequestException('任务不在待审核状态');
    }

    const operator = await this.requireMember(BigInt(task.project_id), userId);

    // 审核人不能是任务执行人
    if (task.assignee_id === BigInt(userId)) {
      throw new ForbiddenException('不能审核自己执行的任务');
    }

    // 审核：DONE → 通过，DOING → 打回
    await this.prisma.task.update({
      where: { task_id: BigInt(taskId) },
      data: { status: dto.action },
    });

    return { message: dto.action === 'DONE' ? '审核通过' : '已打回' };
  }

  // ---- 状态机校验 ----
  private validateTransition(
    from: string,
    to: string,
    task: any,
    newAssigneeId?: number,
  ) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(`不能从 ${from} 直接变更为 ${to}`);
    }

    // TODO → DOING：当前任务或 DTO 中必须有指派人
    if (from === 'TODO' && to === 'DOING') {
      if (!task.assignee_id && !newAssigneeId) {
        throw new BadRequestException('请先指派任务执行人');
      }
    }

    // DOING → REVIEW：只有任务执行人可提交
    if (from === 'DOING' && to === 'REVIEW') {
      const effectiveAssignee = newAssigneeId ?? Number(task.assignee_id);
      if (Number(task.assignee_id) !== effectiveAssignee) {
        throw new ForbiddenException('只有任务执行人可提交审核');
      }
    }
  }

  /** 校验任务截止时间不晚于里程碑截止时间 */
  private async validateDueBeforeMilestone(milestoneId: number, dueDate: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { milestone_id: BigInt(milestoneId), is_deleted: false },
    });
    if (!milestone) throw new NotFoundException('里程碑不存在');

    if (new Date(dueDate) > new Date(milestone.due_date)) {
      throw new BadRequestException(
        `任务截止时间不能晚于里程碑"${milestone.title}"的截止时间（${new Date(milestone.due_date).toLocaleDateString('zh-CN')}）`,
      );
    }
  }
}