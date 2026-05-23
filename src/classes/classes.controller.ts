import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { AuthGuard } from '@nestjs/passport';

interface AuthRequest {
  user: {
    userId?: string;
    sub?: string;
    _id?: string;
    id?: string;
    role?: string;
  };
}

function getUserId(req: AuthRequest): string {
  return req.user.userId || req.user.sub || req.user._id || req.user.id || '';
}

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('teacher/stats')
  async getTeacherStats(@Request() req: AuthRequest) {
    return this.classesService.getTeacherStats(getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('teacher/activity')
  async getTeacherActivity(@Request() req: AuthRequest) {
    return this.classesService.getTeacherActivity(getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-classes')
  async getMyClasses(@Request() req: AuthRequest) {
    const userId = getUserId(req);
    const role = req.user.role;

    if (role === 'ADMIN' || role === 'admin') {
      return this.classesService.findAll();
    }

    if (role === 'TEACHER' || role === 'teacher') {
      return this.classesService.findByTeacher(userId);
    }
    return this.classesService.findByStudent(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll() {
    return this.classesService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('join')
  async join(@Body('code') code: string, @Request() req: AuthRequest) {
    return this.classesService.joinClass(code, getUserId(req), req.user.role);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() createClassDto: unknown, @Request() req: AuthRequest) {
    return this.classesService.create({
      ...(createClassDto as object),
      teacherId: getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/students')
  async addStudent(
    @Param('id') id: string,
    @Body('studentId') studentId: string,
  ) {
    return this.classesService.addStudent(id, studentId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.classesService.findById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/students/remove')
  async removeStudent(
    @Param('id') id: string,
    @Body('studentId') studentId: string,
  ) {
    return this.classesService.removeStudent(id, studentId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/lessons')
  async assignLesson(
    @Param('id') id: string,
    @Body('lessonId') lessonId: string,
    @Body('lessonIds') lessonIds: string[],
  ) {
    const ids = lessonIds?.length ? lessonIds : (lessonId ? [lessonId] : []);
    return this.classesService.assignLessons(id, ids);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/categories')
  async assignCategory(
    @Param('id') id: string,
    @Body('categoryId') categoryId: string,
  ) {
    return this.classesService.assignCategories(id, [categoryId]);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/co-teachers')
  async addCoTeacher(
    @Param('id') id: string,
    @Body('teacherId') teacherId: string,
  ) {
    return this.classesService.addCoTeacher(id, teacherId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/co-teachers/remove')
  async removeCoTeacher(
    @Param('id') id: string,
    @Body('teacherId') teacherId: string,
  ) {
    return this.classesService.removeCoTeacher(id, teacherId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: unknown) {
    return this.classesService.update(id, updateData);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/lessons/:lessonId')
  unassignLesson(@Param('id') id: string, @Param('lessonId') lessonId: string) {
    return this.classesService.unassignLesson(id, lessonId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/clear-lessons')
  clearAllLessons(@Param('id') id: string) {
    return this.classesService.clearAllLessons(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/lessons/:lessonId/completion')
  async getLessonCompletion(
    @Param('id') classId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.classesService.getLessonCompletion(classId, lessonId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.classesService.delete(id);
  }
}
