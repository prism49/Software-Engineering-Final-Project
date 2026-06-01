import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Injectable()
export class MilestoneService {
  constructor(private prisma: PrismaService) {}

  private async requireMember(projectId: bigint, userId: number) {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: BigInt(userId) },
      },
    });
    if (!member || member.is_deleted || member.status !== 'APPROVED') {
      throw new ForbiddenException('你不是该项目成员');
    }
  }

  /** 创建里程碑 */
  async create(projectId: number, userId: number, dto: CreateMilestoneDto) {
    await this.requireMember(BigInt(projectId), userId);

    const milestone = await this.prisma.milestone.create({
      data: {
        project_id: BigInt(projectId),
        title: dto.title,
        description: dto.description ?? null,
        due_date: new Date(dto.due_date),
      },
    });

    return { milestone_id: Number(milestone.milestone_id), title: milestone.title };
  }

  /** 更新里程碑（标题、描述、截止日期，不包含状态） */
  async update(milestoneId: number, userId: number, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { milestone_id: BigInt(milestoneId), is_deleted: false },
    });
    if (!milestone) throw new NotFoundException('里程碑不存在');

    await this.requireMember(BigInt(milestone.project_id), userId);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.due_date !== undefined) data.due_date = new Date(dto.due_date);

    await this.prisma.milestone.update({
      where: { milestone_id: BigInt(milestoneId) },
      data,
    });

    return { message: '里程碑已更新' };
  }

  /** 完成里程碑 — 只有其下所有任务都是 DONE 才可完成 */
  async complete(milestoneId: number, userId: number) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { milestone_id: BigInt(milestoneId), is_deleted: false },
      include: { tasks: { where: { is_deleted: false } } },
    });
    if (!milestone) throw new NotFoundException('里程碑不存在');
    if (milestone.status === 'COMPLETED') {
      throw new BadRequestException('里程碑已完成');
    }

    await this.requireMember(BigInt(milestone.project_id), userId);

    // 校验所有任务是否都已完成
    if (milestone.tasks.length === 0) {
      throw new BadRequestException('里程碑下没有任务');
    }

    const notDone = milestone.tasks.filter((t) => t.status !== 'DONE');
    if (notDone.length > 0) {
      throw new BadRequestException(
        `还有 ${notDone.length} 个任务未完成：${notDone.map((t) => t.title).join('、')}`,
      );
    }

    await this.prisma.milestone.update({
      where: { milestone_id: BigInt(milestoneId) },
      data: { status: 'COMPLETED' },
    });

    return { message: '里程碑已完成' };
  }

  /** 软删除里程碑 — 其下 task 的 milestone_id 置 NULL */
  async delete(milestoneId: number, userId: number) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { milestone_id: BigInt(milestoneId), is_deleted: false },
    });
    if (!milestone) throw new NotFoundException('里程碑不存在');

    await this.requireMember(BigInt(milestone.project_id), userId);

    // 级联：关联 task 的 milestone_id 置 NULL
    await this.prisma.task.updateMany({
      where: { milestone_id: BigInt(milestoneId), is_deleted: false },
      data: { milestone_id: null },
    });

    // 软删除
    await this.prisma.milestone.update({
      where: { milestone_id: BigInt(milestoneId) },
      data: { is_deleted: true },
    });

    return { message: '里程碑已删除' };
  }
}