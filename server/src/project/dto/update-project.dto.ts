import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsInt, MinLength, MaxLength } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['RECRUITING', 'ACTIVE', 'CLOSED'] as const)
  status?: 'RECRUITING' | 'ACTIVE' | 'CLOSED';

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tag_ids?: number[];
}