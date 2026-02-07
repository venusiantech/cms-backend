import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ example: 'USER', enum: ['USER', 'SUPER_ADMIN'] })
  @IsEnum(['USER', 'SUPER_ADMIN'])
  role: 'USER' | 'SUPER_ADMIN';
}

