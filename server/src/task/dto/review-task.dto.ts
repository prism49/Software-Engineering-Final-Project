import { IsEnum } from 'class-validator';

export class ReviewTaskDto {
  @IsEnum(['DONE', 'DOING'] as const)
  action!: 'DONE' | 'DOING';
}