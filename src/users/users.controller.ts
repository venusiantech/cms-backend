import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all users (Super Admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update user role (Super Admin only)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete user (Super Admin only)' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}

