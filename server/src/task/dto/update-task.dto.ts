import { IsString, IsOptional, IsEnum, IsInt, IsDateString, Max, Min } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['TODO', 'DOING', 'REVIEW', 'DONE'] as const)
  status?: 'TODO' | 'DOING' | 'REVIEW' | 'DONE';

  @IsOptional()
  @IsInt()
  assignee_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  weight?: number;

  @IsOptional()
  @IsInt()
  milestone_id?: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}