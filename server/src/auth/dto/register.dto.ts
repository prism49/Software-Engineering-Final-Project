import { IsString, IsEmail, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;

  @IsOptional()
  @IsEnum(['STUDENT', 'TEACHER'] as const)
  role?: 'STUDENT' | 'TEACHER';
}
