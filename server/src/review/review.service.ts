import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  /** 校验是否为项目已批准成员 */
  private async requireApprovedMember(projectId: bigint, userId: number) {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: BigInt(userId) },
      },
    });
    if (!member || member.is_deleted || member.status !== 'APPROVED') {
      throw new ForbiddenException('你不是该项目已批准的成员');
    }
    return member;
  }

  /** 创建互评 */
  async create(projectId: number, reviewerId: number, dto: CreateReviewDto) {
    await this.requireApprovedMember(BigInt(projectId), reviewerId);

    // 项目关闭后才可互评
    const project = await this.prisma.project.findFirst({
      where: { project_id: BigInt(projectId), is_deleted: false },
    });
    if (!project || project.status !== 'CLOSED') {
      throw new BadRequestException('项目关闭后才可提交互评');
    }

    // 不能给自己打分
    if (dto.target_id === reviewerId) {
      throw new BadRequestException('不能给自己评分');
    }

    // 被评人必须是项目成员
    await this.requireApprovedMember(BigInt(projectId), dto.target_id);

    // 检查是否已评过（唯一约束兜底，这里提前给友好提示）
    const existing = await this.prisma.peerReview.findFirst({
      where: {
        project_id: BigInt(projectId),
        reviewer_id: BigInt(reviewerId),
        target_id: BigInt(dto.target_id),
        is_deleted: false,
      },
    });
    if (existing) {
      throw new ConflictException('你已经对该成员评过分了，可以修改但不能重复创建');
    }

    const review = await this.prisma.peerReview.create({
      data: {
        project_id: BigInt(projectId),
        reviewer_id: BigInt(reviewerId),
        target_id: BigInt(dto.target_id),
        score: dto.score,
        content: dto.content ?? null,
      },
    });

    return { review_id: Number(review.review_id), message: '评分已提交' };
  }

  /** 查看项目互评 */
  async findByProject(projectId: number, userId: number, userRole: string) {
    const reviews = await this.prisma.peerReview.findMany({
      where: { project_id: BigInt(projectId), is_deleted: false },
      include: {
        reviewer: { select: { user_id: true, username: true, nickname: true } },
        target: { select: { user_id: true, username: true, nickname: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // 教师：查看完整数据
    if (userRole === 'TEACHER') {
      return reviews.map((r) => ({
        review_id: Number(r.review_id),
        score: r.score,
        content: r.content,
        reviewer: { user_id: Number(r.reviewer.user_id), username: r.reviewer.username, nickname: r.reviewer.nickname },
        target: { user_id: Number(r.target.user_id), username: r.target.username, nickname: r.target.nickname },
        created_at: r.created_at,
      }));
    }

    // 学生：只看自己被评的分数，不暴露评分人
    return reviews
      .filter((r) => r.target.user_id === BigInt(userId))
      .map((r) => ({
        review_id: Number(r.review_id),
        score: r.score,
        content: r.content,
        created_at: r.created_at,
      }));
  }

  /** 修改评分（仅评分人） */
  async update(reviewId: number, userId: number, dto: UpdateReviewDto) {
    const review = await this.prisma.peerReview.findFirst({
      where: { review_id: BigInt(reviewId), is_deleted: false },
    });
    if (!review) throw new NotFoundException('评分记录不存在');

    if (review.reviewer_id !== BigInt(userId)) {
      throw new ForbiddenException('只能修改自己的评分');
    }

    const data: any = {};
    if (dto.score !== undefined) data.score = dto.score;
    if (dto.content !== undefined) data.content = dto.content;

    await this.prisma.peerReview.update({
      where: { review_id: BigInt(reviewId) },
      data,
    });

    return { message: '评分已更新' };
  }
}
