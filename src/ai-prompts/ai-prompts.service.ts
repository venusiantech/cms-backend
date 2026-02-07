import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromptDto, UpdatePromptDto } from './dto/ai-prompt.dto';
import { PromptType } from '@prisma/client';

@Injectable()
export class AiPromptsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePromptDto) {
    return this.prisma.aiPrompt.create({
      data: {
        promptKey: dto.promptKey,
        promptText: dto.promptText,
        promptType: dto.promptType as PromptType,
        templateKey: dto.templateKey,
        createdBy: userId,
      },
    });
  }

  async findAll(templateKey?: string) {
    return this.prisma.aiPrompt.findMany({
      where: templateKey ? { templateKey } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException('AI prompt not found');
    }

    return prompt;
  }

  async update(id: string, dto: UpdatePromptDto) {
    await this.findOne(id);

    return this.prisma.aiPrompt.update({
      where: { id },
      data: {
        ...(dto.promptText && { promptText: dto.promptText }),
        ...(dto.promptType && { promptType: dto.promptType as PromptType }),
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);

    await this.prisma.aiPrompt.delete({
      where: { id },
    });

    return { message: 'AI prompt deleted successfully' };
  }
}

