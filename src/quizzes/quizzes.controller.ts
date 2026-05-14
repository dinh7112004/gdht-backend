import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  async findAll(@Query('lessonId') lessonId?: string) {
    if (lessonId) {
      return this.quizzesService.findByLesson(lessonId);
    }
    return this.quizzesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.quizzesService.findOne(id);
  }

  @Post()
  async create(@Body() data: any) {
    return this.quizzesService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.quizzesService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.quizzesService.delete(id);
  }
}
