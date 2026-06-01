import { IsString, IsOptional, IsInt, Max, Min, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  milestone_id?: number;

  @IsOptional()
  @IsInt()
  assignee_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  weight?: number = 1;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}