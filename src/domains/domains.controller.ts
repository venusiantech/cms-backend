import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DomainsService } from './domains.service';
import { CreateDomainDto, UpdateDomainDto } from './dto/domain.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Domains')
@ApiBearerAuth()
@Controller('domains')
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private domainsService: DomainsService) {}

  @Post()
  @ApiOperation({ summary: 'Register new domain' })
  create(@CurrentUser() user: any, @Body() dto: CreateDomainDto) {
    return this.domainsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all domains (filtered by user)' })
  findAll(@CurrentUser() user: any) {
    return this.domainsService.findAll(user.id, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get domain by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.domainsService.findOne(id, user.id, user.role);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update domain' })
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateDomainDto) {
    return this.domainsService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete domain' })
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.domainsService.delete(id, user.id, user.role);
  }

  @Get(':id/synonyms')
  @ApiOperation({ summary: 'Get synonyms and meanings for domain name' })
  getSynonyms(@Param('id') id: string, @CurrentUser() user: any) {
    return this.domainsService.getSynonyms(id, user.id, user.role);
  }
}

