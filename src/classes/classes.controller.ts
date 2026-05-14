import { Controller, Get, Post, Body, UseGuards, Request, Param, Put, Delete } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) { }

  @UseGuards(AuthGuard('jwt'))
  @Get('teacher/stats')
  async getTeacherStats(@Request() req) {
    const teacherId = req.user.userId || req.user.sub || req.user._id || req.user.id;
    return this.classesService.getTeacherStats(teacherId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll() {
    return this.classesService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('join')
  async join(@Body('code') code: string, @Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user._id || req.user.id;
    return this.classesService.joinClass(code, userId, req.user.role);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-classes')
  async getMyClasses(@Request() req) {
    const userId = req.user.userId || req.user.sub || req.user._id || req.user.id;
    const role = req.user.role;
    
    if (role === 'TEACHER' || role === 'ADMIN') {
      return this.classesService.findByTeacher(userId);
    }
    return this.classesService.findByStudent(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() createClassDto: any, @Request() req) {
    const teacherId = req.user.userId || req.user.sub || req.user._id || req.user.id;
    return this.classesService.create({
      ...createClassDto,
      teacherId: teacherId,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/students')
  async addStudent(@Param('id') id: string, @Body('studentId') studentId: string) {
    return this.classesService.addStudent(id, studentId);
  }
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.classesService.findById(id);
  }
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/students/remove')
  async removeStudent(@Param('id') id: string, @Body('studentId') studentId: string) {
    return this.classesService.removeStudent(id, studentId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/lessons')
  async assignLesson(@Param('id') id: string, @Body('lessonId') lessonId: string) {
    return this.classesService.assignLessons(id, [lessonId]);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/categories')
  async assignCategory(@Param('id') id: string, @Body('categoryId') categoryId: string) {
    return this.classesService.assignCategories(id, [categoryId]);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/co-teachers')
  async addCoTeacher(@Param('id') id: string, @Body('teacherId') teacherId: string) {
    return this.classesService.addCoTeacher(id, teacherId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/co-teachers/remove')
  async removeCoTeacher(@Param('id') id: string, @Body('teacherId') teacherId: string) {
    return this.classesService.removeCoTeacher(id, teacherId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.classesService.update(id, updateData);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.classesService.delete(id);
  }
}
