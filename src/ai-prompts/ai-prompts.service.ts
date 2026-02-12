import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';

interface CreatePromptDto {
  promptKey: string;
  promptText: string;
  promptType: string;
  templateKey: string;
}

interface UpdatePromptDto {
  promptKey?: string;
  promptText?: string;
  promptType?: string;
  templateKey?: string;
}

export class AiPromptsService {
  async create(userId: string, dto: CreatePromptDto) {
    return prisma.aiPrompt.create({
      data: {
        promptKey: dto.promptKey,
        promptText: dto.promptText,
        promptType: dto.promptType as any,
        templateKey: dto.templateKey,
        createdBy: userId,
      },
    });
  }

  async findAll(templateKey?: string) {
    return prisma.aiPrompt.findMany({
      where: templateKey ? { templateKey } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const prompt = await prisma.aiPrompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new AppError('AI prompt not found', 404);
    }

    return prompt;
  }

  async update(id: string, dto: UpdatePromptDto) {
    const prompt = await this.findOne(id);

    return prisma.aiPrompt.update({
      where: { id },
      data: {
        ...(dto.promptKey && { promptKey: dto.promptKey }),
        ...(dto.promptText && { promptText: dto.promptText }),
        ...(dto.promptType && { promptType: dto.promptType as any }),
        ...(dto.templateKey && { templateKey: dto.templateKey }),
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);

    await prisma.aiPrompt.delete({
      where: { id },
    });

    return { message: 'AI prompt deleted successfully' };
  }
}
