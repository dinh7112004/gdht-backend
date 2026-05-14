import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private eventsGateway: EventsGateway
  ) {}

  async findAll(query?: any, user?: any): Promise<Lesson[]> {
    const filter: any = {};
    
    // Nếu không phải ADMIN thì BẮT BUỘC phải có creatorId
    if (user && user.role !== 'ADMIN') {
      const userId = user.userId || user.sub || user._id || user.id;
      if (userId) {
        filter.creatorId = userId;
      } else {
        return []; // Bảo mật: Không có ID thì không hiện gì
      }
    }

    if (query?.category) filter.category = query.category;
    if (query?.categoryId) filter.categoryId = query.categoryId;
    if (query?.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { category: { $regex: query.search, $options: 'i' } }
      ];
    }
    console.log('[DEBUG] Lessons Filter:', JSON.stringify(filter));
    return this.lessonModel.find(filter).exec();
  }

  async findForStudent(classIds: any[], assignedLessonIds: any[], assignedCategoryIds: any[], query?: any): Promise<Lesson[]> {
    const studentClassIds = (classIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const assignedLsnIds = (assignedLessonIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const assignedCatIds = (assignedCategoryIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);

    let filter: any = {};
    
    if (studentClassIds.length > 0) {
      // 1. Tìm tất cả các Category được gán cho các lớp này (qua targetClassIds hoặc qua Class.assignedCategories)
      const assignedCategories = await this.categoryModel.find({
        $or: [
          { targetClassIds: { $in: studentClassIds } },
          { _id: { $in: assignedCatIds } }
        ]
      }).exec();
      const categoryNames = assignedCategories.map(c => c.name);

      // 2. CHỈ hiện bài của lớp mình + bài được giao riêng + bài thuộc category của lớp
      filter = {
        $or: [
          { targetClassIds: { $in: studentClassIds } },
          { _id: { $in: assignedLsnIds } },
          { category: { $in: categoryNames } }
        ]
      };
    } else {
      // NẾU CHƯA VÀO LỚP: Không hiện gì (Chế độ Strict Isolation)
      filter = { _id: { $in: [] } };
    }

    if (query?.category && query.category !== 'Tất cả bài học' && query.category !== 'All Lessons') {
      const categoryRegex = new RegExp(`^${query.category.trim()}$`, 'i');
      // Nếu có query category: Phải thỏa mãn điều kiện bảo mật VÀ phải khớp đúng category
      filter = {
        $and: [
          filter, 
          { category: { $regex: categoryRegex } }
        ]
      };
    }

    console.log('[DEBUG] findForStudent Filter:', JSON.stringify(filter, null, 2));
    const results = await this.lessonModel.find(filter).exec();
    console.log(`[DEBUG] findForStudent Results Count: ${results.length}`);
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
    if (user) {
      cleanedData.creatorId = user.userId || user.sub || user._id;
      // Nếu là giáo viên thì bài giảng KHÔNG phải hệ thống và mặc định riêng tư
      if (user.role === 'TEACHER' || user.role === 'teacher') {
        cleanedData.isSystem = false;
        cleanedData.isPublic = data.isPublic || false;
      }
    }
    const newLesson = new this.lessonModel(cleanedData);
    const saved = await newLesson.save();
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
}
