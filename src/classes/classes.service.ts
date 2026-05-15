import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Class, ClassDocument } from '../schemas/class.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findByTeacher(teacherId: string): Promise<Class[]> {
    if (!teacherId || !Types.ObjectId.isValid(teacherId)) return [];
    const tId = typeof teacherId === 'string' ? new Types.ObjectId(teacherId) : teacherId;
    return this.classModel.find({ 
      $or: [
        { teacherId: tId },
        { teacherId: teacherId },
        { coTeacherIds: tId },
        { coTeacherIds: teacherId }
      ]
    })
      .populate('teacherId', 'fullName')
      .populate('coTeacherIds', 'fullName email')
      .exec();
  }

  async findByStudent(studentId: string): Promise<Class[]> {
    if (!studentId || !Types.ObjectId.isValid(studentId)) return [];
    const sId = typeof studentId === 'string' ? new Types.ObjectId(studentId) : studentId;
    return this.classModel.find({ studentIds: sId })
      .populate('teacherId', 'name')
      .exec();
  }

  async joinClass(code: string, userId: string, role: string = 'STUDENT'): Promise<ClassDocument> {
    const classDoc = await this.classModel.findOne({ code }).exec();
    if (!classDoc) {
      throw new Error('Mã lớp không chính xác');
    }
    
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    if (role === 'TEACHER' || role === 'ADMIN') {
      if (classDoc.teacherId.toString() === userObjectId.toString() || 
          (classDoc.coTeacherIds && classDoc.coTeacherIds.some(id => id.toString() === userObjectId.toString()))) {
        throw new Error('Bạn đã tham gia lớp học này rồi');
      }
      
      const result = await this.classModel.findOneAndUpdate(
        { code },
        { $push: { coTeacherIds: userObjectId } },
        { new: true }
      ).exec();
      if (!result) throw new Error('Cập nhật lớp học thất bại');
      return result;
    } else {
      if (classDoc.studentIds.some(id => id.toString() === userObjectId.toString())) {
        throw new Error('Bạn đã tham gia lớp học này rồi');
      }
      
      const result = await this.classModel.findOneAndUpdate(
        { code },
        { $push: { studentIds: userObjectId } },
        { new: true }
      ).exec();
      if (!result) throw new Error('Cập nhật lớp học thất bại');
      return result;
    }
  }

  async getTeacherStats(teacherId: string) {
    try {
      if (!teacherId || !Types.ObjectId.isValid(teacherId)) {
        return { teacherName: 'Giáo viên', totalClasses: 0, totalStudents: 0, totalLessons: 0, averageProgress: 0, classes: [] };
      }

      const teacher = await this.userModel.findById(teacherId).exec();
      if (!teacher) {
        console.log('Teacher not found in DB for ID:', teacherId);
        return { teacherName: 'Giáo viên', totalClasses: 0, totalStudents: 0, totalLessons: 0, averageProgress: 0, classes: [] };
      }

      const tObjectId = teacher._id;
      console.log('--- DEBUG START ---');
      console.log('Teacher Name:', teacher.fullName);
      console.log('Teacher ID (string):', teacherId);
      console.log('Teacher ID (ObjectId):', tObjectId);
      
      const classes = await this.classModel.find({ 
        $or: [
          { teacherId: tObjectId },
          { coTeacherIds: tObjectId }
        ]
      }).exec();

      console.log(`Found ${classes.length} classes in DB for this teacher`);
      
      let totalStudents = 0;
      const uniqueLessonIds = new Set<string>();
      let totalProgressSum = 0;

      const classesWithDetails = await Promise.all(classes.map(async (cls) => {
        try {
          const details = await this.findById(cls._id.toString());
          if (!details) {
            console.log(`SKIP: Details null for class ${cls.name} (${cls._id})`);
            return null;
          }

          totalStudents += details.studentIds?.length || 0;
          totalProgressSum += details.progress || 0;
          
          (details.assignedLessons || []).forEach((l: any) => {
            const lId = typeof l === 'string' ? l : (l._id ? l._id.toString() : l.toString());
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
          console.error(`ERROR processing class ${cls._id}:`, err);
          return null;
        }
      }));

      const filteredClasses = classesWithDetails.filter(c => c !== null);
      console.log('Final filtered classes count:', filteredClasses.length);
      console.log('--- DEBUG END ---');

      const result = {
        teacherName: teacher?.fullName || 'Giáo viên',
        totalClasses: filteredClasses.length,
        totalStudents,
        totalLessons: uniqueLessonIds.size,
        averageProgress: filteredClasses.length > 0 ? Math.round(totalProgressSum / filteredClasses.length) : 0,
        classes: filteredClasses
      };
      
      console.log('Returning stats:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("CRITICAL Error in getTeacherStats:", error);
      return { teacherName: 'Giáo viên', totalClasses: 0, totalStudents: 0, totalLessons: 0, averageProgress: 0, classes: [] };
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
    const sId = typeof studentId === 'string' ? new Types.ObjectId(studentId) : studentId;
    return this.classModel.findByIdAndUpdate(
      classId,
      { $addToSet: { studentIds: sId } },
      { new: true }
    ).exec();
  }

  async assignLessons(classId: string, lessonIds: string[]) {
    // 1. Cập nhật phía Lớp học
    const updatedClass = await this.classModel.findByIdAndUpdate(
      classId,
      { $addToSet: { assignedLessons: { $each: lessonIds.map(id => new Types.ObjectId(id)) } } },
      { new: true }
    ).exec();

    // 2. Cập nhật phía Bài học (Đồng bộ targetClassIds)
    if (lessonIds.length > 0) {
      await this.lessonModel.updateMany(
        { _id: { $in: lessonIds.map(id => new Types.ObjectId(id)) } },
        { $addToSet: { targetClassIds: new Types.ObjectId(classId) } }
      ).exec();
    }

    return updatedClass;
  }

  async assignCategories(classId: string, categoryIds: string[]) {
    // 1. Cập nhật phía Lớp học
    const updatedClass = await this.classModel.findByIdAndUpdate(
      classId,
      { $addToSet: { assignedCategories: { $each: categoryIds.map(id => new Types.ObjectId(id)) } } },
      { new: true }
    ).exec();

    // 2. Cập nhật phía Chủ đề (Đồng bộ targetClassIds)
    if (categoryIds.length > 0) {
      await this.categoryModel.updateMany(
        { _id: { $in: categoryIds.map(id => new Types.ObjectId(id)) } },
        { $addToSet: { targetClassIds: new Types.ObjectId(classId) } }
      ).exec();
    }

    return updatedClass;
  }

  async addCoTeacher(classId: string, teacherId: string) {
    return this.classModel.findByIdAndUpdate(
      classId,
      { $addToSet: { coTeacherIds: new Types.ObjectId(teacherId) } },
      { new: true }
    ).exec();
  }

  async removeCoTeacher(classId: string, teacherId: string) {
    return this.classModel.findByIdAndUpdate(
      classId,
      { $pull: { coTeacherIds: new Types.ObjectId(teacherId) } },
      { new: true }
    ).exec();
  }

  private async calculateProgress(cls: any): Promise<number> {
    const assignedCategories = await this.categoryModel.find({
      $or: [{ targetClassIds: cls._id }, { targetClassIds: cls._id.toString() }]
    }).exec();
    const catNames = assignedCategories.map(c => c.name);
    const assignedLessons = await this.lessonModel.find({ category: { $in: catNames } }).exec();
    
    const studentCount = cls.studentIds?.length || 0;
    if (assignedLessons.length === 0 || studentCount === 0) return 0;

    let totalCompletedByAll = 0;
    const lessonIds = assignedLessons.map(l => l._id.toString());
    const populatedStudents = await this.userModel.find({ _id: { $in: cls.studentIds } }).select('completedLessons').exec();

    populatedStudents.forEach((student: any) => {
      const completedCount = (student.completedLessons || []).filter((cl: any) => {
        const lId = typeof cl === 'string' ? cl : cl.lessonId?.toString();
        return lessonIds.includes(lId);
      }).length;
      totalCompletedByAll += completedCount;
    });

    return Math.round((totalCompletedByAll / (studentCount * assignedLessons.length)) * 100);
  }

  async findAll(): Promise<any[]> {
    const classes = await this.classModel.find()
      .populate('teacherId', 'fullName')
      .populate('coTeacherIds', 'fullName')
      .populate('studentIds', 'fullName')
      .exec();

    const classesWithProgress = await Promise.all(classes.map(async (cls) => {
      const progress = await this.calculateProgress(cls);
      return {
        ...cls.toObject(),
        progress
      };
    }));

    return classesWithProgress;
  }

  async findById(id: string): Promise<any> {
    if (!id || !Types.ObjectId.isValid(id)) return null;
    const classDoc = await this.classModel.findById(id)
      .populate('teacherId', 'fullName')
      .populate('coTeacherIds', 'fullName email')
      .populate('studentIds', 'fullName email')
      .exec();

    if (!classDoc) return null;

    const classObjectId = new Types.ObjectId(id);
    const assignedCategories = await this.categoryModel.find({ 
      $or: [
        { targetClassIds: classObjectId },
        { targetClassIds: id },
        { isSystem: true },
        { isPublic: true }
      ]
    }).populate('targetClassIds', 'name').sort({ order: 1 }).exec();

    const categoryNames = assignedCategories.map(cat => cat.name);
    const rawLessons = await this.lessonModel.find({ 
      $or: [
        { category: { $in: categoryNames } },
        { _id: { $in: classDoc.assignedLessons || [] } },
        { targetClassIds: classObjectId }
      ]
    }).exec();

    const assignedLessons = rawLessons.map(lesson => {
      const parentCat = assignedCategories.find(c => c.name === lesson.category);
      return {
        ...lesson.toObject(),
        subject: parentCat ? parentCat.subject : (lesson.subject || "Chương trình chung")
      };
    });

    let progress = 0;
    const totalLessonsCount = assignedLessons.length;
    const studentCount = classDoc.studentIds?.length || 0;

    if (totalLessonsCount > 0 && studentCount > 0) {
      let totalCompletedByAll = 0;
      const lessonIds = assignedLessons.map((l: any) => l._id.toString());

      const populatedStudents = await this.userModel.find({ 
        _id: { $in: classDoc.studentIds } 
      }).select('completedLessons').exec();

      populatedStudents.forEach((student: any) => {
        const completedCount = (student.completedLessons || []).filter((cl: any) => {
          const lId = typeof cl === 'string' ? cl : cl.lessonId?.toString();
          return lessonIds.includes(lId);
        }).length;
        totalCompletedByAll += completedCount;
      });

      progress = Math.round((totalCompletedByAll / (studentCount * totalLessonsCount)) * 100);
    }

    return {
      ...(classDoc.toObject() as any),
      assignedCategories,
      assignedLessons,
      progress
    };
  }
  async removeStudent(classId: string, studentId: string) {
    const sId = typeof studentId === 'string' ? new Types.ObjectId(studentId) : studentId;
    return this.classModel.findByIdAndUpdate(
      classId,
      { $pull: { studentIds: sId } },
      { new: true }
    ).exec();
  }

  async update(id: string, updateData: any) {
    if (updateData.teacherId && typeof updateData.teacherId === 'string') {
      updateData.teacherId = new Types.ObjectId(updateData.teacherId);
    }
    return this.classModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async delete(id: string) {
    return this.classModel.findByIdAndDelete(id).exec();
  }
}
