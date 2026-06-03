import { IsInt, IsString, IsOptional, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  target_id!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  content?: string;
}
