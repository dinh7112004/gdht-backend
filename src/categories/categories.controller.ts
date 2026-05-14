import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AuthGuard } from '@nestjs/passport';

import { ClassesService } from '../classes/classes.service';
import { Request } from '@nestjs/common';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly classesService: ClassesService,
  ) { }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Request() req: any) {
    return this.categoriesService.findAll(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('collection-progress')
  async getCollectionProgress(@Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user._id;
    return this.categoriesService.getCollectionProgress(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('for-student')
  async findForStudent(@Request() req: any, @Query() query: any) {
    const studentId = req.user.userId || req.user.sub || req.user._id || req.user.id;
    const myClasses = await this.classesService.findByStudent(studentId);
    const classIds = myClasses.map(c => (c as any)._id);

    const assignedCategoryIds: any[] = [];
    const assignedLessonIds: any[] = [];
    myClasses.forEach(c => {
      if ((c as any).assignedCategories && Array.isArray((c as any).assignedCategories)) {
        (c as any).assignedCategories.forEach(cId => assignedCategoryIds.push(cId));
      }
      if ((c as any).assignedLessons && Array.isArray((c as any).assignedLessons)) {
        (c as any).assignedLessons.forEach(lId => assignedLessonIds.push(lId));
      }
    });

    return this.categoriesService.findForStudent(classIds, assignedCategoryIds, assignedLessonIds, req.query);
  }

  @Get('featured')
  async findFeatured(@Query('userId') userId: string) {
    return this.categoriesService.findFeatured([], userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Request() req: any, @Body() data: any) {
    return this.categoriesService.create(data, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return this.categoriesService.update(id, data, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.categoriesService.delete(id, req.user);
  }
}
