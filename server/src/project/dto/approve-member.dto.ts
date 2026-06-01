import { IsEnum } from 'class-validator';

export class ApproveMemberDto {
  @IsEnum(['APPROVED', 'REJECTED'] as const)
  status!: 'APPROVED' | 'REJECTED';
}