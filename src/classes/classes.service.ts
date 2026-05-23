/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Class, ClassDocument } from '../schemas/class.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByTeacher(teacherId: string): Promise<any[]> {
    if (!teacherId || !Types.ObjectId.isValid(teacherId)) return [];
    const tId = new Types.ObjectId(teacherId);
    const classes = await this.classModel
      .find({
        $or: [
          { teacherId: tId },
          { teacherId },
          { coTeacherIds: tId },
          { coTeacherIds: teacherId },
        ],
      })
      .populate('teacherId', 'fullName')
      .populate('coTeacherIds', 'fullName email')
      .populate('studentIds', 'fullName email')
      .exec();

    return Promise.all(
      classes.map(async (cls) => {
        const progress = await this.calculateProgress(cls);
        return { ...cls.toObject(), progress };
      }),
    );
  }

  async findByStudent(studentId: string): Promise<Class[]> {
    if (!studentId || !Types.ObjectId.isValid(studentId)) return [];
    const sId = new Types.ObjectId(studentId);
    return this.classModel
      .find({ studentIds: sId })
      .populate('teacherId', 'name')
      .exec();
  }

  async joinClass(
    code: string,
    userId: string,
    role: string = 'STUDENT',
  ): Promise<ClassDocument> {
    const classDoc = await this.classModel.findOne({ code }).exec();
    if (!classDoc) {
      throw new Error('Mã lớp không chính xác');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (role === 'TEACHER' || role === 'ADMIN') {
      if (
        classDoc.teacherId.toString() === userObjectId.toString() ||
        (classDoc.coTeacherIds &&
          classDoc.coTeacherIds.some(
            (id) => id.toString() === userObjectId.toString(),
          ))
      ) {
        throw new Error('Bạn đã tham gia lớp học này rồi');
      }

      const result = await this.classModel
        .findOneAndUpdate(
          { code },
          { $push: { coTeacherIds: userObjectId } },
          { new: true },
        )
        .exec();
      if (!result) throw new Error('Cập nhật lớp học thất bại');
      return result;
    } else {
      if (
        classDoc.studentIds.some(
          (id) => id.toString() === userObjectId.toString(),
        )
      ) {
        throw new Error('Bạn đã tham gia lớp học này rồi');
      }

      const result = await this.classModel
        .findOneAndUpdate(
          { code },
          { $push: { studentIds: userObjectId } },
          { new: true },
        )
        .exec();
      if (!result) throw new Error('Cập nhật lớp học thất bại');

      // Notify admins
      const user = await this.userModel.findById(userId).select('fullName').exec();
      const userName = (user as any)?.fullName ?? 'Học sinh';
      void this.notificationsService.notifyAdmins(
        '📚 Học sinh mới tham gia lớp',
        `${userName} vừa tham gia lớp "${result.name}" (${result.code})`,
        'class',
        { classId: result._id?.toString(), userId },
      );

      return result;
    }
  }

  async getTeacherStats(teacherId: string) {
    try {
      if (!teacherId || !Types.ObjectId.isValid(teacherId)) {
        return {
          teacherName: 'Giáo viên',
          totalClasses: 0,
          totalStudents: 0,
          totalLessons: 0,
          averageProgress: 0,
          classes: [],
        };
      }

      const teacher = await this.userModel.findById(teacherId).exec();
      if (!teacher) {
        return {
          teacherName: 'Giáo viên',
          totalClasses: 0,
          totalStudents: 0,
          totalLessons: 0,
          averageProgress: 0,
          classes: [],
        };
      }

      const tObjectId = teacher._id;
      const classes = await this.classModel
        .find({ $or: [{ teacherId: tObjectId }, { coTeacherIds: tObjectId }] })
        .exec();

      let totalStudents = 0;
      const uniqueLessonIds = new Set<string>();
      let totalProgressSum = 0;

      const classesWithDetails = await Promise.all(
        classes.map(async (cls) => {
          try {
            const details = await this.findById(cls._id.toString());
            if (!details) return null;

            totalStudents += details.studentIds?.length || 0;
            totalProgressSum += details.progress || 0;

            (details.assignedLessons || []).forEach((l: any) => {
              const lId =
                typeof l === 'string'
                  ? l
                  : l._id
                    ? l._id.toString()
                    : l.toString();
              uniqueLessonIds.add(lId);
            });

            return {
              id: details._id,
              name: details.name,
              code: details.code,
              students: details.studentIds?.length || 0,
              progress: details.progress || 0,
            };
          } catch (err) {
            console.error(`ERROR processing class ${String(cls._id)}:`, err);
            return null;
          }
        }),
      );

      const filteredClasses = classesWithDetails.filter((c) => c !== null);

      return {
        teacherName: teacher?.fullName || 'Giáo viên',
        totalClasses: filteredClasses.length,
        totalStudents,
        totalLessons: uniqueLessonIds.size,
        averageProgress:
          filteredClasses.length > 0
            ? Math.round(totalProgressSum / filteredClasses.length)
            : 0,
        classes: filteredClasses,
      };
    } catch (error) {
      console.error('CRITICAL Error in getTeacherStats:', error);
      return {
        teacherName: 'Giáo viên',
        totalClasses: 0,
        totalStudents: 0,
        totalLessons: 0,
        averageProgress: 0,
        classes: [],
      };
    }
  }

  async create(createClassDto: any): Promise<ClassDocument> {
    const data = { ...createClassDto };
    if (!data.code) {
      data.code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    if (data.teacherId && typeof data.teacherId === 'string') {
      data.teacherId = new Types.ObjectId(data.teacherId);
    }
    const newClass = new this.classModel(data);
    return newClass.save();
  }

  async addStudent(classId: string, studentId: string) {
    const sId = new Types.ObjectId(studentId);
    return this.classModel
      .findByIdAndUpdate(
        classId,
        { $addToSet: { studentIds: sId } },
        { new: true },
      )
      .exec();
  }

  async assignLessons(classId: string, lessonIds: string[]) {
    const objectIds = lessonIds.map((id) => new Types.ObjectId(id));
    const updatedClass = await this.classModel
      .findByIdAndUpdate(
        classId,
        {
          $addToSet: { assignedLessons: { $each: objectIds } },
          $pullAll: { excludedLessons: objectIds },
        },
        { new: true },
      )
      .exec();

    if (lessonIds.length > 0) {
      await this.lessonModel
        .updateMany(
          { _id: { $in: lessonIds.map((id) => new Types.ObjectId(id)) } },
          { $addToSet: { targetClassIds: new Types.ObjectId(classId) } },
        )
        .exec();

      // Notify all students in the class
      const classDoc = await this.classModel.findById(classId).exec();
      if (classDoc && classDoc.studentIds?.length > 0) {
        const lessons = await this.lessonModel
          .find({ _id: { $in: lessonIds.map((id) => new Types.ObjectId(id)) } })
          .select('title')
          .exec();
        const lessonTitles = lessons.map((l: any) => l.title).join(', ');
        const studentIds = classDoc.studentIds.map((id) => id.toString());
        void this.notificationsService.sendToMany(
          studentIds,
          '📚 Bài tập mới!',
          `Giáo viên vừa giao bài: ${lessonTitles} trong lớp ${classDoc.name}`,
          'assignment',
          { classId, lessonIds },
        );
      }
    }

    return updatedClass;
  }

  async assignCategories(classId: string, categoryIds: string[]) {
    const updatedClass = await this.classModel
      .findByIdAndUpdate(
        classId,
        {
          $addToSet: {
            assignedCategories: {
              $each: categoryIds.map((id) => new Types.ObjectId(id)),
            },
          },
        },
        { new: true },
      )
      .exec();

    if (categoryIds.length > 0) {
      await this.categoryModel
        .updateMany(
          { _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) } },
          { $addToSet: { targetClassIds: new Types.ObjectId(classId) } },
        )
        .exec();

      // Notify all students in the class
      const classDoc = await this.classModel.findById(classId).exec();
      if (classDoc && classDoc.studentIds?.length > 0) {
        const categories = await this.categoryModel
          .find({ _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) } })
          .select('name')
          .exec();
        const catNames = categories.map((c: any) => c.name).join(', ');
        const studentIds = classDoc.studentIds.map((id) => id.toString());
        void this.notificationsService.sendToMany(
          studentIds,
          '📖 Chủ đề mới được giao!',
          `Giáo viên vừa giao chủ đề: ${catNames} trong lớp ${classDoc.name}`,
          'assignment',
          { classId, categoryIds },
        );
      }
    }

    return updatedClass;
  }

  async addCoTeacher(classId: string, teacherId: string) {
    return this.classModel
      .findByIdAndUpdate(
        classId,
        { $addToSet: { coTeacherIds: new Types.ObjectId(teacherId) } },
        { new: true },
      )
      .exec();
  }

  async removeCoTeacher(classId: string, teacherId: string) {
    return this.classModel
      .findByIdAndUpdate(
        classId,
        { $pull: { coTeacherIds: new Types.ObjectId(teacherId) } },
        { new: true },
      )
      .exec();
  }

  private async calculateProgress(cls: any): Promise<number> {
    const classObjectId = cls._id;

    // Only class-specific lessons (no public/system bleed)
    const assignedLessons = await this.lessonModel
      .find({
        $or: [
          { _id: { $in: cls.assignedLessons || [] } },
          { targetClassIds: classObjectId },
        ],
      })
      .exec();

    const studentCount = cls.studentIds?.length || 0;
    if (assignedLessons.length === 0 || studentCount === 0) return 0;

    let totalCompletedByAll = 0;
    const lessonIds = assignedLessons.map((l) => l._id.toString());
    const populatedStudents = await this.userModel
      .find({ _id: { $in: cls.studentIds } })
      .select('completedLessons')
      .exec();

    populatedStudents.forEach((student: any) => {
      const completedCount = (student.completedLessons || []).filter(
        (cl: any) => {
          const lId = typeof cl === 'string' ? cl : cl.lessonId?.toString();
          return lessonIds.includes(lId);
        },
      ).length;
      totalCompletedByAll += completedCount;
    });

    return Math.round(
      (totalCompletedByAll / (studentCount * assignedLessons.length)) * 100,
    );
  }

  async findAll(): Promise<any[]> {
    const classes = await this.classModel
      .find()
      .populate('teacherId', 'fullName')
      .populate('coTeacherIds', 'fullName')
      .populate('studentIds', 'fullName')
      .exec();

    return Promise.all(
      classes.map(async (cls) => {
        const progress = await this.calculateProgress(cls);
        return { ...cls.toObject(), progress };
      }),
    );
  }

  async findById(id: string): Promise<any> {
    if (!id || !Types.ObjectId.isValid(id)) return null;
    const classDoc = await this.classModel
      .findById(id)
      .populate('teacherId', 'fullName')
      .populate('coTeacherIds', 'fullName email')
      .populate('studentIds', 'fullName email')
      .exec();

    if (!classDoc) return null;

    const classObjectId = new Types.ObjectId(id);
    const assignedCategories = await this.categoryModel
      .find({
        $or: [
          { targetClassIds: classObjectId },
          { targetClassIds: id },
        ],
      })
      .populate('targetClassIds', 'name')
      .sort({ order: 1 })
      .exec();

    const categoryNames = assignedCategories.map((cat) => cat.name);
    const rawLessons = await this.lessonModel
      .find({
        $or: [
          { _id: { $in: classDoc.assignedLessons || [] } },
          { targetClassIds: classObjectId },
        ],
        _id: { $nin: classDoc.excludedLessons || [] },
      })
      .exec();

    const assignedLessons = rawLessons.map((lesson) => {
      const parentCat = assignedCategories.find(
        (c) => c.name === lesson.category,
      );
      return {
        ...lesson.toObject(),
        subject: parentCat
          ? parentCat.subject
          : lesson.subject || 'Chương trình chung',
      };
    });

    let progress = 0;
    const totalLessonsCount = assignedLessons.length;
    const studentCount = classDoc.studentIds?.length || 0;
    const lessonIds = assignedLessons.map((l: any) => l._id.toString());

    const lessonSubmissionCounts: Record<string, number> = {};
    let fullySubmittedCount = 0;

    if (totalLessonsCount > 0 && studentCount > 0) {
      let totalCompletedByAll = 0;

      const populatedStudents = await this.userModel
        .find({ _id: { $in: classDoc.studentIds } })
        .select('completedLessons')
        .exec();

      populatedStudents.forEach((student: any) => {
        const completedLessonIds = (student.completedLessons || [])
          .map((cl: any) =>
            typeof cl === 'string' ? cl : cl.lessonId?.toString(),
          )
          .filter(Boolean);

        completedLessonIds.forEach((lId: string) => {
          if (lessonIds.includes(lId)) {
            lessonSubmissionCounts[lId] =
              (lessonSubmissionCounts[lId] || 0) + 1;
          }
        });

        const completedCount = completedLessonIds.filter((lId: string) =>
          lessonIds.includes(lId),
        ).length;
        totalCompletedByAll += completedCount;

        if (
          lessonIds.length > 0 &&
          lessonIds.every((lid) => completedLessonIds.includes(lid))
        ) {
          fullySubmittedCount += 1;
        }
      });

      progress = Math.round(
        (totalCompletedByAll / (studentCount * totalLessonsCount)) * 100,
      );
    }

    const assignedLessonsWithCounts = assignedLessons.map((lesson: any) => ({
      ...lesson,
      submittedCount: lessonSubmissionCounts[lesson._id.toString()] || 0,
    }));

    return {
      ...classDoc.toObject(),
      assignedCategories,
      assignedLessons: assignedLessonsWithCounts,
      progress,
      fullySubmittedCount,
    };
  }

  async getLessonCompletion(classId: string, lessonId: string) {
    if (!Types.ObjectId.isValid(classId) || !Types.ObjectId.isValid(lessonId)) {
      return { completed: [], notCompleted: [] };
    }

    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) return { completed: [], notCompleted: [] };

    const students = await this.userModel
      .find({ _id: { $in: classDoc.studentIds } })
      .select('fullName avatar completedLessons')
      .exec();

    const completed: any[] = [];
    const notCompleted: any[] = [];

    students.forEach((student: any) => {
      const hasCompleted = (student.completedLessons || []).some((cl: any) => {
        const lId = typeof cl === 'string' ? cl : cl.lessonId?.toString();
        return lId === lessonId;
      });
      const info = {
        _id: student._id.toString(),
        fullName: student.fullName,
        avatar: student.avatar || null,
      };
      if (hasCompleted) {
        completed.push(info);
      } else {
        notCompleted.push(info);
      }
    });

    return { completed, notCompleted };
  }

  async unassignLesson(classId: string, lessonId: string) {
    const lid = new Types.ObjectId(lessonId);
    // Also remove this class from the lesson's targetClassIds
    await this.lessonModel.findByIdAndUpdate(
      lessonId,
      { $pull: { targetClassIds: new Types.ObjectId(classId) } },
    ).exec();
    return this.classModel
      .findByIdAndUpdate(
        classId,
        {
          $pullAll: { assignedLessons: [lid] },
          $addToSet: { excludedLessons: lid },
        },
        { new: true },
      )
      .exec();
  }

  async clearAllLessons(classId: string) {
    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) return null;
    const lessonIds = classDoc.assignedLessons || [];
    // Remove this class from each lesson's targetClassIds
    if (lessonIds.length > 0) {
      await this.lessonModel.updateMany(
        { _id: { $in: lessonIds } },
        { $pull: { targetClassIds: new Types.ObjectId(classId) } },
      ).exec();
    }
    return this.classModel.findByIdAndUpdate(
      classId,
      { $set: { assignedLessons: [], excludedLessons: [] } },
      { new: true },
    ).exec();
  }

  async removeStudent(classId: string, studentId: string) {
    const sId = new Types.ObjectId(studentId);
    return this.classModel
      .findByIdAndUpdate(classId, { $pull: { studentIds: sId } }, { new: true })
      .exec();
  }

  async update(id: string, updateData: any) {
    if (updateData.teacherId && typeof updateData.teacherId === 'string') {
      updateData.teacherId = new Types.ObjectId(updateData.teacherId);
    }
    return this.classModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string) {
    return this.classModel.findByIdAndDelete(id).exec();
  }

  async getTeacherActivity(teacherId: string) {
    if (!teacherId || !Types.ObjectId.isValid(teacherId)) {
      return { recentCompletions: [], behindStudents: [] };
    }

    const tObjectId = new Types.ObjectId(teacherId);
    const classes = await this.classModel
      .find({ $or: [{ teacherId: tObjectId }, { coTeacherIds: tObjectId }] })
      .exec();

    if (classes.length === 0) {
      return { recentCompletions: [], behindStudents: [] };
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCompletions: any[] = [];
    const behindStudents: any[] = [];

    for (const cls of classes) {
      const classObjectId = cls._id;

      // Lấy danh sách bài học được giao cho lớp này
      const assignedCategories = await this.categoryModel
        .find({
          $or: [
            { targetClassIds: classObjectId },
            { isSystem: true },
            { isPublic: true },
          ],
        })
        .exec();
      const catNames = assignedCategories.map((c) => c.name);

      const assignedLessons = await this.lessonModel
        .find({
          $or: [
            { category: { $in: catNames } },
            { _id: { $in: cls.assignedLessons || [] } },
            { targetClassIds: classObjectId },
          ],
        })
        .select('_id title')
        .exec();

      if (assignedLessons.length === 0 || !cls.studentIds?.length) continue;

      const lessonMap: Record<string, string> = {};
      assignedLessons.forEach((l: any) => {
        lessonMap[l._id.toString()] = l.title;
      });
      const assignedLessonIds = Object.keys(lessonMap);

      // Lấy dữ liệu học sinh
      const students = await this.userModel
        .find({ _id: { $in: cls.studentIds } })
        .select('fullName completedLessons')
        .exec();

      const behindList: string[] = [];

      for (const student of students) {
        const completions = student.completedLessons || [];

        // Lọc các bài hoàn thành trong 7 ngày gần đây thuộc lớp này
        const recentForClass = completions.filter((cl) => {
          const lId = typeof cl === 'string' ? cl : cl.lessonId?.toString();
          const completedAt = cl.completedAt ? new Date(cl.completedAt) : null;
          return (
            lId &&
            assignedLessonIds.includes(lId) &&
            completedAt &&
            completedAt >= sevenDaysAgo
          );
        });

        recentForClass.forEach((cl) => {
          const lId = typeof cl === 'string' ? cl : cl.lessonId?.toString();
          recentCompletions.push({
            studentName: student.fullName,
            lessonTitle: lessonMap[lId] || 'Bài học',
            lessonId: lId,
            className: cls.name,
            classId: cls._id.toString(),
            score: cl.score ?? null,
            total: cl.total ?? null,
            completedAt: cl.completedAt,
          });
        });

        // Kiểm tra học sinh chưa hoàn thành bài nào
        const completedIds: string[] = completions
          .map((cl) => (typeof cl === 'string' ? cl : cl.lessonId?.toString()))
          .filter(Boolean);
        const hasCompleted = assignedLessonIds.some((id) =>
          completedIds.includes(id),
        );
        if (!hasCompleted) {
          behindList.push(student.fullName);
        }
      }

      if (behindList.length > 0) {
        behindStudents.push({
          className: cls.name,
          classId: cls._id.toString(),
          count: behindList.length,
          total: cls.studentIds.length,
          studentNames: behindList.slice(0, 3),
        });
      }
    } // end for cls

    // Sắp xếp theo thời gian mới nhất
    recentCompletions.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );

    return {
      recentCompletions: recentCompletions.slice(0, 20),
      behindStudents,
    };
  }
}
