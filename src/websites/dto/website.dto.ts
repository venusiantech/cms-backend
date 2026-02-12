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

export class UpdateTemplateDto {
  @ApiProperty({ example: 'modernNews', description: 'Template key to use for the website' })
  @IsString()
  templateKey: string;
}

export class UpdateWebsiteMetadataDto {
  @ApiProperty({ 
    example: 'My Awesome Music Blog', 
    description: 'Custom title for social sharing previews',
    required: false 
  })
  @IsString()
  @IsOptional()
  metaTitle?: string;

  @ApiProperty({ 
    example: 'Discover the latest music trends, reviews, and insights from industry experts.', 
    description: 'Custom description for social sharing previews',
    required: false 
  })
  @IsString()
  @IsOptional()
  metaDescription?: string;

  @ApiProperty({ 
    example: 'https://example.com/images/og-image.jpg', 
    description: 'Custom image URL for social sharing previews (og:image)',
    required: false 
  })
  @IsString()
  @IsOptional()
  metaImage?: string;
}

