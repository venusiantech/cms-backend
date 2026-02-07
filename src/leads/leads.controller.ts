import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit contact form (Public endpoint)' })
  @ApiQuery({ name: 'domain', required: true })
  create(@Query('domain') domain: string, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(domain, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get leads for user websites' })
  findByUser(@CurrentUser() user: any) {
    return this.leadsService.findByUser(user.id, user.role);
  }
}

