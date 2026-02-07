import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePromptDto {
  @ApiProperty({ example: 'hero_heading_templateA' })
  @IsString()
  promptKey: string;

  @ApiProperty({ example: 'Generate a compelling hero heading for a professional website' })
  @IsString()
  promptText: string;

  @ApiProperty({ example: 'TEXT', enum: ['TEXT', 'IMAGE', 'SEO'] })
  @IsEnum(['TEXT', 'IMAGE', 'SEO'])
  promptType: string;

  @ApiProperty({ example: 'templateA' })
  @IsString()
  templateKey: string;
}

export class UpdatePromptDto {
  @ApiProperty({ example: 'Generate a compelling hero heading for a professional website' })
  @IsString()
  @IsOptional()
  promptText?: string;

  @ApiProperty({ example: 'TEXT', enum: ['TEXT', 'IMAGE', 'SEO'] })
  @IsEnum(['TEXT', 'IMAGE', 'SEO'])
  @IsOptional()
  promptType?: string;
}

