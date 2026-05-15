import { Controller, Get, Patch, Param, Body, UseGuards, Post, Request, Query, Inject, forwardRef, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { ClassesService } from '../classes/classes.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ClassesService))
    private readonly classesService: ClassesService
  ) {}

  @Get('leaderboard')
  @UseGuards(AuthGuard('jwt'))
  async getLeaderboard(
    @Query('type') type: 'CLASS' | 'SCHOOL',
    @Query('classId') classId: string,
    @Query('period') period: 'WEEK' | 'MONTH' | 'ALL',
    @Request() req
  ) {
    let studentIds: string[] = [];
    
    if (type === 'CLASS') {
      if (classId) {
        const cls = await this.classesService.findById(classId);
        if (cls && cls.studentIds) {
          studentIds = cls.studentIds.map((s: any) => (s._id || s).toString());
        }
      } else {
        // Fetch classes the user belongs to
        const userId = req.user.userId || req.user.sub || req.user._id;
        const myClasses = await this.classesService.findByStudent(userId);
        
        if (myClasses && myClasses.length > 0) {
          // Get all student IDs from all classes the user belongs to
          const allStudentIds = new Set<string>();
          myClasses.forEach(cls => {
            if (cls.studentIds) {
              cls.studentIds.forEach((s: any) => allStudentIds.add((s._id || s).toString()));
            }
          });
          studentIds = Array.from(allStudentIds);
        }
      }
      
      // Nếu là xếp hạng lớp nhưng không có học sinh nào (hoặc user chưa vào lớp), trả về mảng rỗng
      if (studentIds.length === 0) {
        return [];
      }
    }
    
    return this.usersService.getLeaderboard(studentIds.length > 0 ? studentIds : undefined, period || 'WEEK');
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Body() data: any) {
    return this.usersService.create(data);
  }

  @Get('students')
  async findAllStudents() {
    return this.usersService.findByRole('STUDENT');
  }

  @Get('teachers')
  async findAllTeachers() {
    return this.usersService.findByRole('TEACHER');
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Body() data: any, @Request() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.usersService.update(userId, data);
  }

  @Post('rename')
  @UseGuards(AuthGuard('jwt'))
  async rename(@Body('newName') newName: string, @Request() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.usersService.rename(userId, newName);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post('complete-lesson/:lessonId')
  @UseGuards(AuthGuard('jwt'))
  async completeLesson(
    @Param('lessonId') lessonId: string, 
    @Body('score') score: number,
    @Body('total') total: number,
    @Body('xpReward') xpReward: number,
    @Body('answers') answers: number[],
    @Request() req
  ) {
    return this.usersService.addCompletedLesson(req.user.userId || req.user.id, lessonId, score, total, xpReward, answers);
  }

  @Post('last-lesson/:lessonId')
  @UseGuards(AuthGuard('jwt'))
  async updateLastLesson(@Param('lessonId') lessonId: string, @Request() req) {
    return this.usersService.updateLastLesson(req.user.userId || req.user.id, lessonId);
  }

  @Post('claim-mission')
  @UseGuards(AuthGuard('jwt'))
  async claimMission(@Body() body: { missionId: string, xpReward: number }, @Request() req) {
    return this.usersService.claimMission(req.user.userId || req.user.id, body.missionId, body.xpReward);
  }

  @Post('reset-all-students')
  async resetAllStudents() {
    return this.usersService.resetAllStudentsProgress();
  }
  @Get('360/:id')
  async getStudent360(@Param('id') id: string) {
    const student360 = await this.usersService.getStudent360(id);
    if (!student360) return null;

    // Fetch class info
    const classes = await this.classesService.findByStudent(id);
    const className = classes && classes.length > 0 ? classes[0].name : "Chưa vào lớp học";

    return {
      ...student360,
      user: {
        ...student360.user,
        className
      }
    };
  }

  @Post('toggle-save/:postId')
  @UseGuards(AuthGuard('jwt'))
  async toggleSave(@Param('postId') postId: string, @Request() req) {
    return this.usersService.toggleSavedPost(req.user.userId || req.user.id, postId);
  }
}
