import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ApplyProjectDto } from './dto/apply-project.dto';
import { ApproveMemberDto } from './dto/approve-member.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  /** 项目大厅 — 支持按状态和标签筛选 */
  async findAll(query: QueryProjectDto) {
    const where: any = { is_deleted: false };

    if (query.status) {
      where.status = query.status;
    }
    if (query.tag) {
      where.project_required_tags = {
        some: { tag: { name: query.tag } },
      };
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        leader: { select: { user_id: true, username: true, nickname: true } },
        members: {
          where: { is_deleted: false },
          select: { user_id: true, role: true, status: true },
        },
        project_required_tags: {
          include: { tag: { select: { tag_id: true, name: true } } },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return projects.map((p) => ({
      project_id: Number(p.project_id),
      title: p.title,
      description: p.description,
      max_members: p.max_members,
      status: p.status,
      deadline: p.deadline,
      leader: {
        user_id: Number(p.leader.user_id),
        username: p.leader.username,
        nickname: p.leader.nickname,
      },
      member_count: p.members.length,
      members: p.members.map((m) => ({
        user_id: Number(m.user_id),
        role: m.role,
        status: m.status,
      })),
      tags: p.project_required_tags.map((t) => ({
        tag_id: Number(t.tag.tag_id),
        name: t.tag.name,
      })),
      task_count: p._count.tasks,
      created_at: p.created_at,
      is_overdue:
        new Date(p.deadline) < new Date() && p.status !== 'CLOSED',
    }));
  }

  /** 项目详情 */
  async findOne(projectId: number) {
    const p = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
      include: {
        leader: { select: { user_id: true, username: true, nickname: true } },
        members: {
          where: { is_deleted: false },
          include: { user: { select: { user_id: true, username: true, nickname: true } } },
        },
        milestones: {
          where: { is_deleted: false },
          orderBy: { due_date: 'asc' },
        },
        project_required_tags: {
          include: { tag: { select: { tag_id: true, name: true } } },
        },
        _count: { select: { tasks: true } },
      },
    });

    if (!p) throw new NotFoundException('项目不存在');

    return {
      project_id: Number(p.project_id),
      title: p.title,
      description: p.description,
      max_members: p.max_members,
      status: p.status,
      deadline: p.deadline,
      leader: {
        user_id: Number(p.leader.user_id),
        username: p.leader.username,
        nickname: p.leader.nickname,
      },
      members: p.members.map((m) => ({
        user_id: Number(m.user_id),
        username: m.user.username,
        nickname: m.user.nickname,
        role: m.role,
        status: m.status,
        joined_at: m.joined_at,
      })),
      milestones: p.milestones.map((m) => ({
        milestone_id: Number(m.milestone_id),
        title: m.title,
        description: m.description,
        status: m.status,
        due_date: m.due_date,
        is_overdue:
          new Date(m.due_date) < new Date() && m.status !== 'COMPLETED',
      })),
      tags: p.project_required_tags.map((t) => ({
        tag_id: Number(t.tag.tag_id),
        name: t.tag.name,
      })),
      task_count: p._count.tasks,
      created_at: p.created_at,
      is_overdue:
        new Date(p.deadline) < new Date() && p.status !== 'CLOSED',
    };
  }

  /** 创建项目 — 创建者自动成为队长 */
  async create(userId: number, dto: CreateProjectDto) {
    const { tag_ids, ...data } = dto;

    const project = await this.prisma.project.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        max_members: data.max_members ?? 5,
        deadline: new Date(data.deadline),
        leader_id: BigInt(userId),
        // 队长自动加入
        members: {
          create: {
            user_id: BigInt(userId),
            role: 'LEADER',
            status: 'APPROVED',
          },
        },
        // 关联标签
        ...(tag_ids && tag_ids.length > 0
          ? {
              project_required_tags: {
                create: tag_ids.map((tagId) => ({ tag_id: BigInt(tagId) })),
              },
            }
          : {}),
      },
    });

    return { project_id: Number(project.project_id), title: project.title };
  }

  /** 更新项目 */
  async update(projectId: number, userId: number, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    if (!project) throw new NotFoundException('项目不存在');

    await this.requireLeader(BigInt(projectId), userId);

    // 状态流转校验
    if (dto.status && dto.status !== project.status) {
      const from = project.status;
      const to = dto.status;
      if (from === 'CLOSED') {
        throw new BadRequestException('已关闭的项目不能修改状态');
      }
      if (to === 'CLOSED') {
        // 关闭前先查是否有未完成任务
        const unfinished = await this.prisma.task.count({
          where: {
            project_id: BigInt(projectId),
            is_deleted: false,
            status: { not: 'DONE' },
          },
        });
        if (unfinished > 0) {
          throw new BadRequestException(`项目还有 ${unfinished} 个任务未完成，无法关闭`);
        }
      } else if (from === 'RECRUITING' && to === 'ACTIVE') {
        // 队长手动开始项目
      } else if (from === 'ACTIVE' && to === 'RECRUITING') {
        // 队长重新招募
      } else {
        throw new BadRequestException(`不能从 ${from} 变为 ${to}`);
      }
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.deadline !== undefined) data.deadline = new Date(dto.deadline);

    await this.prisma.project.update({
      where: { project_id: BigInt(projectId) },
      data,
    });

    // 更新标签
    if (dto.tag_ids !== undefined) {
      await this.replaceTags(BigInt(projectId), dto.tag_ids);
    }

    return { message: '项目已更新' };
  }

  /** 替换项目标签（内部方法） */
  private async replaceTags(projectId: bigint, tagIds: number[]) {
    await this.prisma.projectRequiredTag.updateMany({
      where: { project_id: projectId, is_deleted: false },
      data: { is_deleted: true },
    });

    for (const tagId of tagIds) {
      const existing = await this.prisma.projectRequiredTag.findUnique({
        where: {
          project_id_tag_id: { project_id: projectId, tag_id: BigInt(tagId) },
        },
      });
      if (existing) {
        await this.prisma.projectRequiredTag.update({
          where: {
            project_id_tag_id: { project_id: projectId, tag_id: BigInt(tagId) },
          },
          data: { is_deleted: false, updated_at: new Date() },
        });
      } else {
        await this.prisma.projectRequiredTag.create({
          data: { project_id: projectId, tag_id: BigInt(tagId) },
        });
      }
    }
  }

  /** 校验操作人是队长 */
  private async requireLeader(projectId: bigint, userId: number) {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: BigInt(userId),
        },
      },
    });
    if (!membership || membership.role !== 'LEADER') {
      throw new ForbiddenException('仅队长可操作');
    }
  }

  /** 申请加入项目 */
  async apply(projectId: number, userId: number, dto: ApplyProjectDto) {
    const project = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
      include: {
        members: { where: { is_deleted: false } },
      },
    });

    if (!project) throw new NotFoundException('项目不存在');
    if (project.status !== 'RECRUITING') {
      throw new BadRequestException('项目不在招募阶段');
    }

    // 已有 approved 成员数（计数逻辑调整）
    const approvedCount = project.members.filter(
      (m) => m.status === 'APPROVED',
    ).length;
    if (approvedCount >= project.max_members) {
      throw new BadRequestException('项目已满员');
    }

    // 检查是否已有申请记录
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: BigInt(projectId),
          user_id: BigInt(userId),
        },
      },
    });

    if (existing && !existing.is_deleted) {
      if (existing.status === 'APPROVED') {
        throw new ConflictException('你已是项目成员');
      }
      if (existing.status === 'PENDING') {
        throw new ConflictException('你已提交过申请，请等待审批');
      }
      // REJECTED — 允许重新申请，更新记录
      await this.prisma.projectMember.update({
        where: {
          project_id_user_id: {
            project_id: BigInt(projectId),
            user_id: BigInt(userId),
          },
        },
        data: {
          status: 'PENDING',
          apply_reason: dto.apply_reason ?? null,
          updated_at: new Date(),
          is_deleted: false,
        },
      });
      return { message: '申请已重新提交' };
    }

    await this.prisma.projectMember.create({
      data: {
        project_id: BigInt(projectId),
        user_id: BigInt(userId),
        role: 'MEMBER',
        status: 'PENDING',
        apply_reason: dto.apply_reason ?? null,
      },
    });

    return { message: '申请已提交，等待队长审批' };
  }

  /** 审批成员（队长专用） */
  async approveMember(
    projectId: number,
    targetUserId: number,
    operatorId: number,
    dto: ApproveMemberDto,
  ) {
    // 验证操作人是队长
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: BigInt(projectId),
          user_id: BigInt(operatorId),
        },
      },
    });

    if (!membership || membership.role !== 'LEADER') {
      throw new ForbiddenException('仅队长可审批');
    }

    // 更新目标成员状态
    const target = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: BigInt(projectId),
          user_id: BigInt(targetUserId),
        },
      },
    });

    if (!target || target.is_deleted) {
      throw new NotFoundException('申请记录不存在');
    }
    if (target.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理过');
    }

    await this.prisma.projectMember.update({
      where: {
        project_id_user_id: {
          project_id: BigInt(projectId),
          user_id: BigInt(targetUserId),
        },
      },
      data: { status: dto.status },
    });

    // 如果全部审批完毕，将项目状态改为 ACTIVE
    if (dto.status === 'APPROVED') {
      const project = await this.prisma.project.findUnique({
        where: { project_id: BigInt(projectId) },
        include: {
          members: { where: { is_deleted: false } },
        },
      });

      const approvedCount = project!.members.filter(
        (m) => m.status === 'APPROVED',
      ).length;

      if (approvedCount >= project!.max_members) {
        await this.prisma.project.update({
          where: { project_id: BigInt(projectId) },
          data: { status: 'ACTIVE' },
        });
      }
    }

    return { message: dto.status === 'APPROVED' ? '已批准' : '已拒绝' };
  }
}
