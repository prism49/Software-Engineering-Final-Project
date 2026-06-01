import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) {}

  /** 获取所有标签 */
  async findAll() {
    const tags = await this.prisma.tag.findMany({
      where: { is_deleted: false },
      orderBy: { tag_id: 'asc' },
    });
    return tags.map((t) => ({ tag_id: Number(t.tag_id), name: t.name }));
  }

  /** 获取当前用户的技能标签 */
  async findUserTags(userId: number) {
    const tags = await this.prisma.userSkillTag.findMany({
      where: { user_id: BigInt(userId), is_deleted: false },
      include: { tag: true },
    });
    return tags.map((t) => ({ tag_id: Number(t.tag.tag_id), name: t.tag.name }));
  }

  /** 替换当前用户的技能标签（整批替换） */
  async updateUserTags(userId: number, tagIds: number[]) {
    // 软删除旧标签
    await this.prisma.userSkillTag.updateMany({
      where: { user_id: BigInt(userId), is_deleted: false },
      data: { is_deleted: true },
    });

    // 插入新标签（恢复旧记录或新建）
    for (const tagId of tagIds) {
      // 检查标签是否存在
      const tag = await this.prisma.tag.findUnique({ where: { tag_id: BigInt(tagId) } });
      if (!tag) throw new NotFoundException(`标签 ${tagId} 不存在`);

      // 尝试恢复已删除的旧记录
      const existing = await this.prisma.userSkillTag.findUnique({
        where: {
          user_id_tag_id: { user_id: BigInt(userId), tag_id: BigInt(tagId) },
        },
      });

      if (existing) {
        await this.prisma.userSkillTag.update({
          where: {
            user_id_tag_id: { user_id: BigInt(userId), tag_id: BigInt(tagId) },
          },
          data: { is_deleted: false, updated_at: new Date() },
        });
      } else {
        await this.prisma.userSkillTag.create({
          data: { user_id: BigInt(userId), tag_id: BigInt(tagId) },
        });
      }
    }

    return this.findUserTags(userId);
  }
}