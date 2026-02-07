import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContentDto {
  @ApiProperty({ 
    example: { text: 'Updated content here' },
    description: 'Content object (structure depends on block type)'
  })
  @IsObject()
  content: Record<string, any>;
}

