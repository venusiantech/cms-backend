import { IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWebsiteDto {
  @ApiProperty({ example: 'uuid-of-domain' })
  @IsUUID()
  domainId: string;

  @ApiProperty({ example: 'templateA' })
  @IsString()
  templateKey: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  contactFormEnabled?: boolean;
}

export class UpdateAdsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  adsEnabled?: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  adsApproved?: boolean;
}

export class UpdateContactFormDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  contactFormEnabled: boolean;
}

