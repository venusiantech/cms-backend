import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDomainDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  domainName: string;
}

export class UpdateDomainDto {
  @ApiProperty({ example: 'ACTIVE', enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsEnum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'])
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 'Baseball cap - headwear worn for protection from sun' })
  @IsString()
  @IsOptional()
  selectedMeaning?: string;
}

