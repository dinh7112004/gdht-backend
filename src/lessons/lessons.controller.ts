import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { AuthGuard } from '@nestjs/passport';
import { ClassesService } from '../classes/classes.service';

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly classesService: ClassesService
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Query() query: any, @Request() req: any) {
    return this.lessonsService.findAll(query, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('for-student')
  async findForStudent(@Request() req: any, @Query() query: any) {
    const studentId = req.user.userId || req.user.sub || req.user._id || req.user.id;
    const myClasses = await this.classesService.findByStudent(studentId);
    const classIds = myClasses.map(c => (c as any)._id);
    
    // Thu thập tất cả các bài giảng và chủ đề được gán trực tiếp cho lớp
    const assignedLessonIds: any[] = [];
    const assignedCategoryIds: any[] = [];
    
    myClasses.forEach(c => {
      const cls = c as any;
      if (cls.assignedLessons && Array.isArray(cls.assignedLessons)) {
        cls.assignedLessons.forEach(lId => assignedLessonIds.push(lId));
      }
      if (cls.assignedCategories && Array.isArray(cls.assignedCategories)) {
        cls.assignedCategories.forEach(cId => assignedCategoryIds.push(cId));
      }
    });
    
    return this.lessonsService.findForStudent(classIds, assignedLessonIds, assignedCategoryIds, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.lessonsService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() data: any, @Request() req: any) {
    return this.lessonsService.create(data, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return this.lessonsService.update(id, data, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.lessonsService.delete(id, req.user);
  }
}
