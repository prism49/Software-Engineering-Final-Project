import { IsInt, IsString, IsOptional, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsString()
  content?: string;
}
