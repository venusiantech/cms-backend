import { Controller, Put, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { UpdateContentDto } from './dto/content.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Content')
@ApiBearerAuth()
@Controller('content-blocks')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Put(':id')
  @ApiOperation({ summary: 'Manually update content block' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentService.update(id, user.id, user.role, dto);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate content using AI' })
  regenerate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contentService.regenerate(id, user.id, user.role);
  }

  @Post(':id/regenerate-title')
  @ApiOperation({ summary: 'Regenerate only the title of a blog' })
  regenerateTitle(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contentService.regenerateTitle(id, user.id, user.role);
  }

  @Post(':id/regenerate-content')
  @ApiOperation({ summary: 'Regenerate only the content of a blog' })
  regenerateContent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contentService.regenerateContent(id, user.id, user.role);
  }

  @Post(':id/regenerate-image')
  @ApiOperation({ summary: 'Regenerate only the image of a blog' })
  regenerateImage(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contentService.regenerateImage(id, user.id, user.role);
  }

  @Delete('section/:sectionId')
  @ApiOperation({ summary: 'Delete a blog section (except hero)' })
  deleteSection(@Param('sectionId') sectionId: string, @CurrentUser() user: any) {
    return this.contentService.deleteSection(sectionId, user.id, user.role);
  }
}

