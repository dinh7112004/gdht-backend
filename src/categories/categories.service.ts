import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(user?: any): Promise<any[]> {
    
    const filter: any = {};
    const role = user?.role?.toUpperCase();
    const isAdmin = role === 'ADMIN';
    
    if (!isAdmin) {
      const userId = user?.userId || user?.sub || user?._id || user?.id;
      if (userId) {
        filter.$or = [
          { creatorId: userId },
          { isSystem: true },
          { isPublic: true },
          { targetClassIds: { $in: [userId] } } // Fallback cho các trường hợp đặc biệt
        ];
      } else {
        filter.$or = [
          { isSystem: true },
          { isPublic: true }
        ];
      }
    }
    
    const results = await this.categoryModel.find(filter).sort({ order: 1 }).exec();
    return results;
  }

  async getCollectionProgress(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return [];

    // Lấy danh sách ID lớp học của học sinh này
    const studentClasses = await this.userModel.db.model('Class').find({ studentIds: userId }).exec();
    const classIds = studentClasses.map(c => c._id);

    // CHỈ lấy các chủ đề:
    // 1. Là hệ thống (isSystem: true)
    // 2. Được giao cho lớp của học sinh này (targetClassIds)
    // 3. Được công khai (isPublic: true)
    const filter = {
      $or: [
        { isSystem: true },
        { isPublic: true },
        { targetClassIds: { $in: classIds } }
      ]
    };

    const categories = await this.categoryModel.find(filter).sort({ order: 1 }).exec();
    const completedLessonIds = user.completedLessons?.map(l => l.lessonId) || [];

    const results = await Promise.all(categories.map(async (cat) => {
      const totalLessons = await this.lessonModel.countDocuments({ category: cat.name });
      const completedCount = await this.lessonModel.countDocuments({
        _id: { $in: completedLessonIds },
        category: cat.name
      });

      return {
        id: cat._id,
        title: cat.name,
        progress: `${completedCount}/${totalLessons}`,
        percent: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
        img: cat.imageUrl || "https://img.freepik.com/free-vector/hand-drawn-vietnamese-new-year-illustration_23-2148812444.jpg",
        isPrivate: !cat.isSystem && !cat.isPublic
      };
    }));

    return results;
  }

  async findForStudent(classIds: any[], assignedCategoryIds: any[], assignedLessonIds: any[] = [], query?: any): Promise<Category[]> {
    const studentClassIds = (classIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const assignedCatIds = (assignedCategoryIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);
    const assignedLsnIds = (assignedLessonIds || []).map(id => typeof id === 'string' ? new Types.ObjectId(id) : id);

    let filter: any;

    if (studentClassIds.length > 0) {
      // Tìm các tên chủ đề từ các bài học được gán cho lớp
      const lessonsInClass = await this.lessonModel.find({ 
        $or: [
          { targetClassIds: { $in: studentClassIds } },
          { _id: { $in: assignedLsnIds } }
        ]
      }).select('category categoryId').exec();
      const categoryNamesFromLessons = lessonsInClass.map(l => l.category).filter(name => !!name);
      const categoryIdsFromLessons = lessonsInClass.map(l => l.categoryId).filter(id => !!id);

      filter = {
        $and: [
          {
            $or: [
              { _id: { $in: [...assignedCatIds, ...categoryIdsFromLessons] } },
              { name: { $in: categoryNamesFromLessons } },
              { targetClassIds: { $in: studentClassIds } },
              { isSystem: true },
              { isPublic: true }
            ]
          }
        ]
      };

      // Handle search/subject query
      if (query && query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        filter.$and.push({
          $or: [
            { name: { $regex: searchRegex } },
            { subject: { $regex: searchRegex } },
            { description: { $regex: searchRegex } }
          ]
        });
      }
    } else {
      // NẾU CHƯA VÀO LỚP: Chỉ hiện các chủ đề hệ thống/công khai (tùy chính sách cách ly)
      // Ở đây ta giữ chế độ Strict: Chỉ hiện nếu có lớp, hoặc hiện System nếu muốn
      filter = { 
        $or: [
          { isSystem: true },
          { isPublic: true }
        ]
      };
    }

    const categories = await this.categoryModel.find(filter).populate('targetClassIds', 'name').sort({ order: 1 }).exec();
    
    // Tìm tên của các chủ đề được gán trực tiếp cho lớp (GIỐNG HỆT LOGIC TRONG LESSONS SERVICE)
    const assignedCats = await this.categoryModel.find({ 
      $or: [
        { targetClassIds: { $in: studentClassIds } },
        { _id: { $in: assignedCatIds } }
      ]
    }).select('name').exec();
    const assignedCatNames = assignedCats.map(c => c.name);

    return Promise.all(categories.map(async (cat) => {
      // Đếm bài học dựa trên bộ lọc bảo mật và logic hiển thị thông minh (khớp tên OR khớp bài được giao)
      const categoryRegex = new RegExp(`^${cat.name.trim()}$`, 'i');
      
      const count = await this.lessonModel.countDocuments({ 
        $and: [
          // 1. Phải thỏa mãn điều kiện bảo mật (Authorized)
          {
            $or: [
              { targetClassIds: { $in: studentClassIds } },
              { _id: { $in: assignedLsnIds } },
              { category: { $in: assignedCatNames } }
            ]
          },
          // 2. Phải khớp Category này OR là bài được giao riêng cho lớp
          {
            $or: [
              { category: { $regex: categoryRegex } },
              { _id: { $in: assignedLsnIds } }
            ]
          }
        ]
      });
      console.log(`[DEBUG] Category: ${cat.name}, Count: ${count}`);
      
      return {
        ...cat.toObject(),
        lessonCount: count
      };
    }));
  }

  async findFeatured(userClassIds?: any[], userId?: string): Promise<CategoryDocument[]> {
    let finalClassIds = userClassIds || [];
    
    if (userId && Types.ObjectId.isValid(userId) && finalClassIds.length === 0) {
      const studentClasses = await this.userModel.db.model('Class').find({ studentIds: userId }).exec();
      finalClassIds = studentClasses.map(c => c._id);
    }

    const filter: any = {
      isFeatured: true,
      $or: [
        { isPublic: true },
        { isSystem: true },
        { targetClassIds: { $in: finalClassIds } }
      ]
    };
    
    return this.categoryModel.find(filter).populate('targetClassIds', 'name').sort({ order: 1 }).exec();
  }

  private cleanImageUrl(data: any) {
    if (data && typeof data.imageUrl === 'string') {
      data.imageUrl = data.imageUrl.replace(/\s/g, '');
    }
    return data;
  }

  async create(data: any, user?: any): Promise<CategoryDocument> {
    const cleanedData = this.cleanImageUrl(data);
    let teacherClassIds: string[] = [];

    if (user) {
      cleanedData.creatorId = user.userId || user.sub || user._id;
      // Nếu là giáo viên thì mặc định KHÔNG PHẢI là hệ thống và KHÔNG CÔNG KHAI
      if (user.role === 'TEACHER' || user.role === 'teacher') {
        cleanedData.isSystem = false;
        cleanedData.isPublic = data.isPublic || false;

        // TỰ ĐỘNG LẤY TẤT CẢ LỚP CỦA GIÁO VIÊN NÀY
        const ClassesModel = this.userModel.db.model('Class');
        const teacherClasses = await ClassesModel.find({
          $or: [
            { teacherId: cleanedData.creatorId },
            { coTeacherIds: cleanedData.creatorId }
          ]
        }).select('_id').exec();
        
        teacherClassIds = teacherClasses.map(c => c._id.toString());
        if (!cleanedData.targetClassIds || cleanedData.targetClassIds.length === 0) {
          cleanedData.targetClassIds = teacherClassIds;
        }
      }
    }

    const newCategory = new this.categoryModel(cleanedData);
    const saved = await newCategory.save();

    // ĐỒNG BỘ NGƯỢC LẠI: Cập nhật danh sách chủ đề của các lớp
    if (teacherClassIds.length > 0) {
      const ClassesModel = this.userModel.db.model('Class');
      await ClassesModel.updateMany(
        { _id: { $in: teacherClassIds.map(id => new Types.ObjectId(id)) } },
        { $addToSet: { assignedCategories: saved._id } }
      ).exec();
    }

    this.eventsGateway.emitDataChange('categoryUpdated', saved);
    return saved;
  }

  async update(id: string, data: any, user?: any): Promise<CategoryDocument | null> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) return null;

    if (user && (user.role === 'TEACHER' || user.role === 'teacher')) {
      const userId = user.userId || user.sub || user._id;
      // Chỉ cho phép giáo viên sửa bài của chính mình
      if (category.creatorId?.toString() !== userId.toString()) {
        throw new Error('Bạn không có quyền chỉnh sửa chủ đề này');
      }
    }

    const cleanedData = this.cleanImageUrl(data);
    const updated = await this.categoryModel.findByIdAndUpdate(id, cleanedData, { new: true }).exec();
    
    // Nếu đổi tên chủ đề, cần cập nhật lại tên category trong tất cả bài học liên quan
    if (updated && data.name && data.name !== category.name) {
      await this.lessonModel.updateMany(
        { $or: [{ categoryId: id }, { category: category.name }] },
        { category: data.name, categoryId: id }
      ).exec();
    }

    this.eventsGateway.emitDataChange('categoryUpdated', updated);
    return updated;
  }


  async delete(id: string, user?: any): Promise<any> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) return null;

    if (user && user.role === 'teacher') {
      const userId = user.userId || user.sub || user._id;
      if (category.creatorId?.toString() !== userId.toString()) {
        throw new Error('Bạn không có quyền xóa chủ đề này');
      }
    }

    const deleted = await this.categoryModel.findByIdAndDelete(id).exec();
    this.eventsGateway.emitDataChange('categoryUpdated', { id, deleted: true });
    return deleted;
  }
}
