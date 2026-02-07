import { Controller, Post, Put, Body, Param, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WebsitesService } from './websites.service';
import { GenerateWebsiteDto, UpdateAdsDto, UpdateContactFormDto } from './dto/website.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebsiteQueueService } from '../queue/website-queue.service';

@ApiTags('Websites')
@ApiBearerAuth()
@Controller('websites')
@UseGuards(JwtAuthGuard)
export class WebsitesController {
  constructor(
    private websitesService: WebsitesService,
    private queueService: WebsiteQueueService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate complete website with AI (background job)' })
  async generate(@CurrentUser() user: any, @Body() dto: GenerateWebsiteDto) {
    const jobId = await this.queueService.addWebsiteGenerationJob({
      domainId: dto.domainId,
      userId: user.id,
      templateKey: dto.templateKey,
      contactFormEnabled: dto.contactFormEnabled ?? true,
    });

    return {
      jobId,
      message: 'Website generation started. Use the job ID to check status.',
    };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Check website generation job status' })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.queueService.getJobStatus(jobId);
  }

  @Put(':id/ads')
  @ApiOperation({ summary: 'Update ads settings' })
  updateAds(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateAdsDto,
  ) {
    return this.websitesService.updateAds(id, user.id, user.role, dto);
  }

  @Post(':websiteId/generate-more-blogs')
  @ApiOperation({ summary: 'Generate 3 more blogs for the website (background job)' })
  async generateMoreBlogs(
    @Param('websiteId') websiteId: string,
    @CurrentUser() user: any,
  ) {
    const jobId = await this.queueService.addGenerateMoreBlogsJob(websiteId, user.id);

    return {
      jobId,
      message: 'Blog generation started. Use the job ID to check status.',
    };
  }

  @Put(':id/contact-form')
  @ApiOperation({ summary: 'Update contact form settings' })
  updateContactForm(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateContactFormDto,
  ) {
    return this.websitesService.updateContactForm(id, user.id, user.role, dto);
  }
}

