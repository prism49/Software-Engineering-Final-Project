import { IsOptional, IsString } from 'class-validator';

export class QueryProjectDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}