import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  async findAll() {
    return this.subjectsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() data: any) {
    return this.subjectsService.create(data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.subjectsService.update(id, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.subjectsService.delete(id);
  }

  @Post('seed')
  async seed() {
    return this.subjectsService.seed();
  }
}
