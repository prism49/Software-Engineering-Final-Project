import { IsOptional, IsString } from 'class-validator';

export class ApplyProjectDto {
  @IsOptional()
  @IsString()
  apply_reason?: string;
}