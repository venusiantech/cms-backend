import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AiPromptsService } from './ai-prompts.service';
import { CreatePromptDto, UpdatePromptDto } from './dto/ai-prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('AI Prompts')
@ApiBearerAuth()
@Controller('ai-prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN') // Only super admin can manage AI prompts
export class AiPromptsController {
  constructor(private aiPromptsService: AiPromptsService) {}

  @Post()
  @ApiOperation({ summary: 'Create AI prompt (Super Admin only)' })
  create(@CurrentUser() user: any, @Body() dto: CreatePromptDto) {
    return this.aiPromptsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all AI prompts' })
  @ApiQuery({ name: 'templateKey', required: false })
  findAll(@Query('templateKey') templateKey?: string) {
    return this.aiPromptsService.findAll(templateKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AI prompt by ID' })
  findOne(@Param('id') id: string) {
    return this.aiPromptsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update AI prompt' })
  update(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
    return this.aiPromptsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete AI prompt' })
  delete(@Param('id') id: string) {
    return this.aiPromptsService.delete(id);
  }
}

