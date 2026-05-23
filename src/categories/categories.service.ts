import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Class, ClassDocument } from '../schemas/class.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { EventsGateway } from '../events/events.gateway';

type FindAllUser = {
  role?: string;
  userId?: string;
  sub?: string;
  _id?: string;
  id?: string;
};

type JwtUser = {
  role?: string;
  userId?: string;
  sub?: string;
  _id?: string;
};

type CompletedLesson = {
  lessonId: string;
  score?: number;
  total?: number;
  xpGained?: number;
  completedAt?: Date;
};

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(user?: FindAllUser): Promise<CategoryDocument[]> {
    const filter: Record<string, unknown> = {};
    const role =
      typeof user?.role === 'string' ? user.role.toUpperCase() : undefined;
    const isAdmin = role === 'ADMIN';

    if (!isAdmin) {
      const userId = user?.userId ?? user?.sub ?? user?._id ?? user?.id;
      if (userId) {
        filter.$or = [
          { creatorId: userId },
          { isSystem: true },
          { isPublic: true },
          { targetClassIds: { $in: [userId] } },
        ];
      } else {
        filter.$or = [{ isSystem: true }, { isPublic: true }];
      }
    }

    return this.categoryModel.find(filter).sort({ order: 1 }).exec();
  }

  async getCollectionProgress(userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return [];
    }
    const user = await this.userModel.findById(userId).exec();
    if (!user) return [];

    const studentClasses = await this.classModel
      .find({ studentIds: userId })
      .select('_id assignedCategories assignedLessons')
      .exec();
    const classIds = studentClasses.map((c) => c._id);

    // Chưa vào lớp nào → không hiện gì
    if (classIds.length === 0) {
      return [];
    }

    const assignedCatIds = studentClasses.flatMap(
      (c) => c.assignedCategories ?? [],
    );
    const assignedLessonIds = studentClasses.flatMap(
      (c) => c.assignedLessons ?? [],
    );

    // Tìm categories mà lớp học sinh có quyền truy cập
    // 1. Category được gán trực tiếp vào lớp (targetClassIds)
    // 2. Category được gán qua assignedCategories của class
    // 3. Category có bài học được giao cho lớp
    const lessonsInClass = await this.lessonModel
      .find({
        $or: [
          { targetClassIds: { $in: classIds } },
          { _id: { $in: assignedLessonIds } },
        ],
      })
      .select('category categoryId')
      .exec();

    const catNamesFromLessons = lessonsInClass
      .map((l) => l.category)
      .filter((n): n is string => !!n);
    const catIdsFromLessons = lessonsInClass
      .map((l) => l.categoryId)
      .filter((id): id is Types.ObjectId => !!id);

    const categories = await this.categoryModel
      .find({
        $or: [
          { targetClassIds: { $in: classIds } },
          { _id: { $in: [...assignedCatIds, ...catIdsFromLessons] } },
          { name: { $in: catNamesFromLessons } },
        ],
      })
      .sort({ order: 1 })
      .exec();

    const completedLessonIds = (user.completedLessons as CompletedLesson[]).map(
      (l) => l.lessonId,
    );

    return Promise.all(
      categories.map(async (cat) => {
        const totalLessons = await this.lessonModel.countDocuments({
          $and: [
            { $or: [{ category: cat.name }, { categoryId: cat._id }] },
            {
              $or: [
                { targetClassIds: { $in: classIds } },
                { _id: { $in: assignedLessonIds } },
              ],
            },
          ],
        });
        const completedCount = await this.lessonModel.countDocuments({
          _id: { $in: completedLessonIds },
          $or: [{ category: cat.name }, { categoryId: cat._id }],
        });

        return {
          id: cat._id,
          title: cat.name,
          progress: `${completedCount}/${totalLessons}`,
          percent:
            totalLessons > 0
              ? Math.round((completedCount / totalLessons) * 100)
              : 0,
          img:
            cat.imageUrl ??
            'https://img.freepik.com/free-vector/hand-drawn-vietnamese-new-year-illustration_23-2148812444.jpg',
          isPrivate: !cat.isSystem && !cat.isPublic,
        };
      }),
    );
  }

  async findForStudent(
    classIds: (string | Types.ObjectId)[],
    assignedCategoryIds: (string | Types.ObjectId)[],
    assignedLessonIds: (string | Types.ObjectId)[] = [],
    query?: { search?: string },
  ): Promise<Array<CategoryDocument & { lessonCount: number }>> {
    const studentClassIds = classIds.map((id) =>
      typeof id === 'string' ? new Types.ObjectId(id) : id,
    );
    const assignedCatIds = assignedCategoryIds.map((id) =>
      typeof id === 'string' ? new Types.ObjectId(id) : id,
    );
    const assignedLsnIds = assignedLessonIds.map((id) =>
      typeof id === 'string' ? new Types.ObjectId(id) : id,
    );

    let filter: Record<string, unknown>;

    if (studentClassIds.length > 0) {
      const lessonsInClass = await this.lessonModel
        .find({
          $or: [
            { targetClassIds: { $in: studentClassIds } },
            { _id: { $in: assignedLsnIds } },
          ],
        })
        .select('category categoryId')
        .exec();

      const categoryNamesFromLessons = lessonsInClass
        .map((l) => l.category)
        .filter((name): name is string => !!name);
      const categoryIdsFromLessons = lessonsInClass
        .map((l) => l.categoryId)
        .filter((id): id is Types.ObjectId => !!id);

      const andClauses: Record<string, unknown>[] = [
        {
          $or: [
            { _id: { $in: [...assignedCatIds, ...categoryIdsFromLessons] } },
            { name: { $in: categoryNamesFromLessons } },
            { targetClassIds: { $in: studentClassIds } },
          ],
        },
      ];

      if (query?.search) {
        const searchRegex = new RegExp(query.search, 'i');
        andClauses.push({
          $or: [
            { name: { $regex: searchRegex } },
            { subject: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
          ],
        });
      }

      filter = { $and: andClauses };
    } else {
      // Chưa vào lớp nào → không hiện gì
      return [];
    }

    const categories = await this.categoryModel
      .find(filter)
      .populate('targetClassIds', 'name')
      .sort({ order: 1 })
      .exec();

    const assignedCats = await this.categoryModel
      .find({
        $or: [
          { targetClassIds: { $in: studentClassIds } },
          { _id: { $in: assignedCatIds } },
        ],
      })
      .select('name')
      .exec();
    const assignedCatNames = assignedCats.map((c) => c.name);

    // Count accessible lessons for this student's classes
    const accessibleLessons = await this.lessonModel
      .find({
        $or: [
          { targetClassIds: { $in: studentClassIds } },
          { _id: { $in: assignedLsnIds } },
          { category: { $in: assignedCatNames } },
        ],
      })
      .select('category categoryId')
      .lean()
      .exec();

    const countMap = new Map<string, number>();
    for (const lesson of accessibleLessons) {
      const key = lesson.categoryId?.toString() ?? lesson.category ?? '';
      if (key) countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    return categories.map((cat) => {
      const count =
        (countMap.get(cat._id.toString()) ?? 0) +
        (countMap.get(cat.name) ?? 0);
      return {
        ...cat.toObject(),
        lessonCount: count,
      } as unknown as CategoryDocument & { lessonCount: number };
    });
  }

  async findFeatured(
    userClassIds?: Types.ObjectId[],
    userId?: string,
  ): Promise<CategoryDocument[]> {
    let finalClassIds: Types.ObjectId[] = userClassIds ?? [];
    let assignedCategoryIds: Types.ObjectId[] = [];

    if (
      userId &&
      Types.ObjectId.isValid(userId) &&
      finalClassIds.length === 0
    ) {
      const studentClasses = await this.classModel
        .find({ studentIds: userId })
        .select('_id assignedCategories')
        .exec();
      finalClassIds = studentClasses.map((c) => c._id);
      // Lấy danh sách category được gán trực tiếp vào lớp
      assignedCategoryIds = studentClasses.flatMap(
        (c) => c.assignedCategories ?? [],
      );
    }

    if (finalClassIds.length === 0) {
      return [];
    }

    // Hiện featured categories nếu:
    // 1. targetClassIds chứa lớp của học sinh, HOẶC
    // 2. Category được gán trực tiếp vào lớp qua assignedCategories, HOẶC
    // 3. Category là công khai (isPublic: true) — dành cho category tạo từ CMS
    return this.categoryModel
      .find({
        isFeatured: true,
        $or: [
          { targetClassIds: { $in: finalClassIds } },
          { _id: { $in: assignedCategoryIds } },
          { isPublic: true },
        ],
      })
      .populate('targetClassIds', 'name')
      .sort({ order: 1 })
      .exec();
  }

  async findTeacherFeatured(teacherId: string): Promise<CategoryDocument[]> {
    const teacherClasses = await this.classModel
      .find({
        $or: [{ teacherId: teacherId }, { coTeacherIds: teacherId }],
      })
      .select('_id')
      .exec();

    const classIds = teacherClasses.map((c) => c._id);

    // Nếu không có lớp, vẫn trả về các chủ đề nổi bật do giáo viên tạo
    const orClauses: Record<string, unknown>[] = [
      { creatorId: teacherId },
      { isPublic: true },
      { isSystem: true },
    ];
    if (classIds.length > 0) {
      orClauses.push({ targetClassIds: { $in: classIds } });
    }

    return this.categoryModel
      .find({
        isFeatured: true,
        $or: orClauses,
      })
      .sort({ order: 1 })
      .exec();
  }

  private cleanImageUrl(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (typeof data.imageUrl === 'string') {
      data.imageUrl = data.imageUrl.replace(/\s/g, '');
    }
    return data;
  }

  async create(
    data: Record<string, unknown>,
    user?: JwtUser,
  ): Promise<CategoryDocument> {
    const cleanedData = this.cleanImageUrl({ ...data });
    let teacherClassIds: string[] = [];

    if (user) {
      const creatorId = user.userId ?? user.sub ?? user._id;
      cleanedData.creatorId = creatorId;

      if (user.role === 'TEACHER' || user.role === 'teacher') {
        cleanedData.isSystem = false;
        cleanedData.isPublic = data.isPublic ?? false;

        const teacherClasses = await this.classModel
          .find({
            $or: [{ teacherId: creatorId }, { coTeacherIds: creatorId }],
          })
          .select('_id')
          .exec();

        teacherClassIds = teacherClasses.map((c) => c._id.toString());
        if (
          !cleanedData.targetClassIds ||
          (cleanedData.targetClassIds as unknown[]).length === 0
        ) {
          cleanedData.targetClassIds = teacherClassIds;
        }
      }
    }

    const newCategory = new this.categoryModel(cleanedData);
    const saved = await newCategory.save();

    if (teacherClassIds.length > 0) {
      await this.classModel
        .updateMany(
          { _id: { $in: teacherClassIds.map((id) => new Types.ObjectId(id)) } },
          { $addToSet: { assignedCategories: saved._id } },
        )
        .exec();
    }

    this.eventsGateway.emitDataChange('categoryUpdated', saved);
    return saved;
  }

  async update(
    id: string,
    data: Record<string, unknown>,
    user?: JwtUser,
  ): Promise<CategoryDocument | null> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) return null;

    if (user && (user.role === 'TEACHER' || user.role === 'teacher')) {
      const userId = user.userId ?? user.sub ?? user._id;
      if (category.creatorId?.toString() !== userId) {
        throw new Error('Bạn không có quyền chỉnh sửa chủ đề này');
      }
    }

    const cleanedData = this.cleanImageUrl({ ...data });
    const updated = await this.categoryModel
      .findByIdAndUpdate(id, cleanedData, { new: true })
      .exec();

    if (
      updated &&
      typeof data.name === 'string' &&
      data.name !== category.name
    ) {
      await this.lessonModel
        .updateMany(
          { $or: [{ categoryId: id }, { category: category.name }] },
          { category: data.name, categoryId: id },
        )
        .exec();
    }

    this.eventsGateway.emitDataChange('categoryUpdated', updated);
    return updated;
  }

  async delete(id: string, user?: JwtUser): Promise<CategoryDocument | null> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) return null;

    if (user?.role === 'teacher') {
      const userId = user.userId ?? user.sub ?? user._id;
      if (category.creatorId?.toString() !== userId) {
        throw new Error('Bạn không có quyền xóa chủ đề này');
      }
    }

    const deleted = await this.categoryModel.findByIdAndDelete(id).exec();
    this.eventsGateway.emitDataChange('categoryUpdated', { id, deleted: true });
    return deleted;
  }
}
