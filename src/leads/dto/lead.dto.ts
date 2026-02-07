import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Acme Inc', required: false })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'I would like to inquire about...' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'CONTACT', enum: ['CONTACT', 'ADS_INQUIRY'], required: false })
  @IsString()
  @IsOptional()
  leadType?: string;
}

