import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private eventsGateway: EventsGateway
  ) {}

  async findAll(query?: any, user?: any): Promise<Lesson[]> {
    
    const filter: any = {};
    
    // Tìm theo Category (Ưu tiên ID, fallback sang Tên)
    if (query?.categoryId) {
      filter.$or = [
        { categoryId: query.categoryId },
        { category: query.category }
      ];
    } else if (query?.category) {
      const categoryRegex = new RegExp(`^${query.category.trim()}$`, 'i');
      filter.category = { $regex: categoryRegex };
    }

    if (query?.search) {
      filter.$or = [
        ...(filter.$or || []),
        { title: { $regex: query.search, $options: 'i' } },
        { content: { $regex: query.search, $options: 'i' } }
      ];
    }

    const lessons = await this.lessonModel.find(filter).exec();
    return lessons;
  }

  async findForStudent(classIds: any[], assignedLessonIds: any[], assignedCategoryIds: any[], query?: any, excludedLessonIds: any[] = []): Promise<Lesson[]> {
    const studentClassIds = (classIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const assignedLsnIds = (assignedLessonIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const assignedCatIds = (assignedCategoryIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const excludedIds = (excludedLessonIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);

    let filter: any = {};

    if (studentClassIds.length > 0) {
      // Chỉ hiện bài của lớp mình + bài được giao riêng
      filter = {
        $or: [
          { targetClassIds: { $in: studentClassIds } },
          { _id: { $in: assignedLsnIds } },
        ]
      };
    } else {
      // Chưa vào lớp: không hiện gì
      return [];
    }

    // NẾU có query theo Category: lọc thêm theo category
    if ((query?.category && query.category !== 'Tất cả bài học' && query.category !== 'All Lessons') || query?.categoryId) {
      const categoryName = query.category?.trim();
      const categoryRegex = categoryName ? new RegExp(`^${categoryName}$`, 'i') : null;

      const categoryMatch: any = {
        $or: [
          ...(query.categoryId ? [{ categoryId: query.categoryId }] : []),
          ...(categoryRegex ? [
            { category: { $regex: categoryRegex } },
            { subject: { $regex: categoryRegex } },
          ] : []),
        ]
      };

      // Kết hợp filter hiện tại với category filter
      filter = { $and: [filter, categoryMatch] };
    }

    let exclusionFilter = {};
    if (excludedIds.length > 0 && assignedLsnIds.length > 0) {
      const effectiveExcluded = excludedIds.filter(
        eid => !assignedLsnIds.some(aid => aid.toString() === eid.toString())
      );
      if (effectiveExcluded.length > 0) {
        exclusionFilter = { _id: { $nin: effectiveExcluded } };
      }
    } else if (excludedIds.length > 0) {
      exclusionFilter = { _id: { $nin: excludedIds } };
    }

    const results = await this.lessonModel.find({
      ...filter,
      ...exclusionFilter,
    }).exec();
    return results;
  }

  async findOne(id: string): Promise<LessonDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.lessonModel.findById(id).exec();
  }

  private cleanImageUrl(data: any) {
    if (data && typeof data.imageUrl === 'string') {
      data.imageUrl = data.imageUrl.replace(/\s/g, '');
    }
    return data;
  }

  async create(data: any, user?: any): Promise<LessonDocument> {
    const cleanedData = this.cleanImageUrl(data);
    let teacherClassIds: string[] = [];

    if (user) {
      cleanedData.creatorId = user.userId || user.sub || user._id;
      // Nếu là giáo viên thì bài giảng KHÔNG phải hệ thống và mặc định riêng tư
      if (user.role === 'TEACHER' || user.role === 'teacher') {
        cleanedData.isSystem = false;
        cleanedData.isPublic = data.isPublic || false;

        // TỰ ĐỘNG LẤY TẤT CẢ LỚP CỦA GIÁO VIÊN NÀY
        // (Sử dụng Model trực tiếp để tránh vòng lặp dependency nếu inject ClassesService)
        const ClassesModel = this.userModel.db.model('Class');
        const teacherClasses = await ClassesModel.find({
          $or: [
            { teacherId: cleanedData.creatorId },
            { coTeacherIds: cleanedData.creatorId }
          ]
        }).select('_id').exec();
        
        teacherClassIds = teacherClasses.map(c => c._id.toString());
        // Nếu user không chọn lớp cụ thể, tự động gán tất cả lớp của họ
        if (!cleanedData.targetClassIds || cleanedData.targetClassIds.length === 0) {
          cleanedData.targetClassIds = teacherClassIds;
        }
      }
    }
    
    const newLesson = new this.lessonModel(cleanedData);
    const saved = await newLesson.save();

    // ĐỒNG BỘ NGƯỢC LẠI: Cập nhật danh sách bài giảng của các lớp
    if (teacherClassIds.length > 0) {
      const ClassesModel = this.userModel.db.model('Class');
      await ClassesModel.updateMany(
        { _id: { $in: teacherClassIds.map(id => new Types.ObjectId(id)) } },
        { $addToSet: { assignedLessons: saved._id } }
      ).exec();
    }

    this.eventsGateway.emitDataChange('lessonUpdated', saved);
    return saved;
  }

  async update(id: string, data: any, user?: any): Promise<LessonDocument | null> {
    if (!isValidObjectId(id)) return null;
    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson) return null;

    if (user && (user.role === 'TEACHER' || user.role === 'teacher')) {
      const userId = user.userId || user.sub || user._id;
      if (lesson.creatorId?.toString() !== userId.toString()) {
        throw new Error('Bạn không có quyền chỉnh sửa bài giảng này');
      }
    }

    const cleanedData = this.cleanImageUrl(data);
    const updated = await this.lessonModel.findByIdAndUpdate(id, cleanedData, { new: true }).exec();

    // Sync class.assignedLessons when targetClassIds changes
    if (cleanedData.targetClassIds && Array.isArray(cleanedData.targetClassIds)) {
      const ClassesModel = this.userModel.db.model('Class');
      const newClassIds = cleanedData.targetClassIds.map((cid: any) =>
        typeof cid === 'string' ? new Types.ObjectId(cid) : cid
      );
      if (newClassIds.length > 0) {
        await ClassesModel.updateMany(
          { _id: { $in: newClassIds } },
          { $addToSet: { assignedLessons: updated?._id } }
        ).exec();
      }
    }

    this.eventsGateway.emitDataChange('lessonUpdated', updated);
    return updated;
  }

  async delete(id: string, user?: any): Promise<any> {
    if (!isValidObjectId(id)) return null;
    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson) return null;

    if (user && (user.role === 'TEACHER' || user.role === 'teacher')) {
      const userId = user.userId || user.sub || user._id;
      if (lesson.creatorId?.toString() !== userId.toString()) {
        throw new Error('Bạn không có quyền xóa bài giảng này');
      }
    }

    const deleted = await this.lessonModel.findByIdAndDelete(id).exec();
    this.eventsGateway.emitDataChange('lessonUpdated', { id, deleted: true });
    return deleted;
  }

  async syncAllLessonsToClasses(): Promise<{ synced: number }> {
    const ClassesModel = this.userModel.db.model('Class');
    const lessons = await this.lessonModel
      .find({ targetClassIds: { $exists: true, $not: { $size: 0 } } })
      .select('_id targetClassIds')
      .lean()
      .exec();

    let synced = 0;
    for (const lesson of lessons) {
      if (lesson.targetClassIds && lesson.targetClassIds.length > 0) {
        await ClassesModel.updateMany(
          { _id: { $in: lesson.targetClassIds } },
          { $addToSet: { assignedLessons: lesson._id } }
        ).exec();
        synced++;
      }
    }
    return { synced };
  }
}
