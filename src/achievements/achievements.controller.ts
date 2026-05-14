import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  findAll() {
    return this.achievementsService.findAll();
  }

  @Post('claim/:id')
  @UseGuards(AuthGuard('jwt'))
  claim(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.achievementsService.claim(userId, id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.achievementsService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.achievementsService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.achievementsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.achievementsService.delete(id);
  }
}
