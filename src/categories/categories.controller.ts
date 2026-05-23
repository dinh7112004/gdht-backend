import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { CategoriesService } from './categories.service';
import { ClassesService } from '../classes/classes.service';
import { ClassDocument } from '../schemas/class.schema';

type JwtUser = {
  role?: string;
  userId?: string;
  sub?: string;
  _id?: string;
  id?: string;
};

type AuthRequest = Request & { user: JwtUser };

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly classesService: ClassesService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Req() req: AuthRequest) {
    return this.categoriesService.findAll(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('collection-progress')
  async getCollectionProgress(@Req() req: AuthRequest) {
    const userId = req.user.userId ?? req.user.sub ?? req.user._id ?? '';
    return this.categoriesService.getCollectionProgress(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('for-student')
  async findForStudent(
    @Req() req: AuthRequest,
    @Query() query: { search?: string },
  ) {
    const studentId =
      req.user.userId ?? req.user.sub ?? req.user._id ?? req.user.id ?? '';
    const myClasses = (await this.classesService.findByStudent(
      studentId,
    )) as ClassDocument[];

    const classIds = myClasses.map((c) => c._id);
    const assignedCategoryIds: Types.ObjectId[] = [];
    const assignedLessonIds: Types.ObjectId[] = [];

    for (const c of myClasses) {
      if (Array.isArray(c.assignedCategories)) {
        assignedCategoryIds.push(...c.assignedCategories);
      }
      if (Array.isArray(c.assignedLessons)) {
        assignedLessonIds.push(...c.assignedLessons);
      }
    }

    return this.categoriesService.findForStudent(
      classIds,
      assignedCategoryIds,
      assignedLessonIds,
      query,
    );
  }

  @Get('featured')
  async findFeatured(@Query('userId') userId: string) {
    return this.categoriesService.findFeatured([], userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('teacher-featured')
  async findTeacherFeatured(@Req() req: AuthRequest) {
    const teacherId = req.user.userId ?? req.user.sub ?? req.user._id ?? '';
    return this.categoriesService.findTeacherFeatured(teacherId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Req() req: AuthRequest, @Body() data: Record<string, unknown>) {
    return this.categoriesService.create(data, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    return this.categoriesService.update(id, data, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.categoriesService.delete(id, req.user);
  }
}
