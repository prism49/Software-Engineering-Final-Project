import { IsString, IsOptional, IsInt, Max, Min, IsDateString, MinLength, MaxLength, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(2)
  @Max(20)
  max_members?: number = 5;

  @IsDateString()
  deadline!: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tag_ids?: number[];
}