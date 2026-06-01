import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  due_date!: string;
}