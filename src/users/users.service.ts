import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Achievement, AchievementDocument } from '../schemas/achievement.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    private eventsGateway: EventsGateway
  ) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().select('-password').sort({ createdAt: -1 }).exec();
  }

  async findByRole(role: string): Promise<User[]> {
    return this.userModel.find({ role }).select('-password').exec();
  }

  async update(id: string, data: any): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    // Không cho phép cập nhật tên qua API này để bắt buộc dùng thẻ đổi tên
    const { fullName, ...updateData } = data;
    
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true })
      .select('-password')
      .populate('inventory.itemId')
      .populate('equippedItems.avatarId')
      .populate('equippedItems.frameId')
      .exec();
  }

  async findOne(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    return this.userModel.findById(id).select('-password').exec();
  }

  async addCompletedLesson(userId: string, lessonId: string, score: number, total: number, xpReward: number = 50, answers: number[] = []) {
    if (!isValidObjectId(userId) || !isValidObjectId(lessonId)) return null;
    const user = await this.userModel.findById(userId);
    if (!user) return null;

    // Lấy thông tin bài học để cộng thêm điểm thưởng của bài học (điểm bài học)
    const lesson = await this.lessonModel.findById(lessonId);
    const lessonXpReward = lesson?.xpReward || 0;

    const numScore = Number(score) || 0;
    const numTotal = Number(total) || 0;
    const numQuizXpReward = Number(xpReward) || 0; // Điểm từ Quiz (câu hỏi)

    // Tổng XP = Điểm bài học + Điểm Quiz
    const totalXpGained = lessonXpReward + numQuizXpReward;

    // Thưởng Gems: Đúng hết được 2, làm xong được 1
    const gemReward = (numScore === numTotal && numTotal > 0) ? 2 : 1;

    // 1. Cập nhật kết quả bài học và cộng điểm
    // Loại bỏ kết quả cũ trong mảng (nếu có)
    user.completedLessons = (user.completedLessons || []).filter(l => l.lessonId !== lessonId);

    // Cộng điểm trực tiếp trên object user
    user.xp = (Number(user.xp) || 0) + totalXpGained;
    user.gems = (Number(user.gems) || 0) + gemReward;
    
    // Tự động tính Level: Cứ 500 XP lên 1 cấp
    user.level = Math.floor(user.xp / 500) + 1;
    
    // Thêm kết quả mới vào mảng
    user.completedLessons.push({ 
      lessonId, 
      score: numScore, 
      total: numTotal, 
      xpGained: totalXpGained,
      answers: answers || [],
      completedAt: new Date() 
    });

    // 2. Xử lý Streak
    const now = new Date();
    const lastLesson = user.completedLessons.length > 1 
      ? user.completedLessons[user.completedLessons.length - 2]
      : null;
    
    if (!lastLesson || (now.getTime() - new Date(lastLesson.completedAt).getTime() > 12 * 60 * 60 * 1000)) {
       user.streak = (user.streak || 0) + 1;
    }

    user.markModified('completedLessons');
    console.log(`[DEBUG] Saving user ${userId}. New XP: ${user.xp}, New Gems: ${user.gems}, Lessons: ${user.completedLessons.length}`);
    
    const savedUser = await user.save();
    console.log(`[DEBUG] User saved successfully: ${!!savedUser}`);

    if (savedUser) {
      await this.checkAndAwardAchievements(userId);
      this.eventsGateway.emitDataChange('userProgressUpdated', { userId, lessonId });
    }

    return savedUser;
  }

  private async checkAndAwardAchievements(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    const achievementsToAward: string[] = []; // Codes

    // 1. FIRST_LESSON
    if (user.completedLessons.length >= 1) achievementsToAward.push('FIRST_LESSON');

    // 2. STREAK_7
    if (user.streak >= 7) achievementsToAward.push('STREAK_7');

    // 3. PERFECT_SCORE_5
    const perfectLessons = user.completedLessons.filter(l => l.score === l.total && l.total > 0);
    if (perfectLessons.length >= 5) achievementsToAward.push('PERFECT_SCORE_5');

    // Awarding logic
    const allAchievements = await this.achievementModel.find({ code: { $in: achievementsToAward } });
    let modified = false;

    for (const ach of allAchievements) {
      const hasIt = user.achievements.some(a => a.achievementId?.toString() === ach._id.toString());
      if (!hasIt) {
        user.achievements.push({
          achievementId: ach._id.toString() as any,
          level: ach.level,
          earnedAt: new Date()
        });
        modified = true;
      }
    }

    if (modified) {
      await user.save();
      this.eventsGateway.emitDataChange('achievementsUpdated', { userId });
    }
  }
  async updateLastLesson(userId: string, lessonId: string) {
    if (!isValidObjectId(userId) || !isValidObjectId(lessonId)) return null;
    const updated = await this.userModel.findByIdAndUpdate(userId, { lastLessonId: lessonId }, { new: true }).select('-password');
    if (updated) {
      this.eventsGateway.emitDataChange('userProgressUpdated', { userId, lessonId });
    }
    return updated;
  }

  async claimMission(userId: string, missionId: string, xpReward: number) {
    if (!isValidObjectId(userId)) return null;
    const user = await this.userModel.findById(userId);
    if (!user) return null;

    // Kiểm tra xem đã nhận trong hôm nay chưa
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyClaimed = user.claimedMissions?.some(m => 
      m.missionId === missionId && new Date(m.claimedAt) >= today
    );

    if (alreadyClaimed) {
      throw new Error('Nhiệm vụ này đã được nhận thưởng trong hôm nay');
    }

    // Cộng XP và lưu vết
    user.xp += xpReward;
    
    // Tính lại Level
    user.level = Math.floor(user.xp / 500) + 1;

    if (!user.claimedMissions) user.claimedMissions = [];
    user.claimedMissions.push({ missionId, claimedAt: new Date(), xpReward });

    return user.save();
  }

  async resetAllStudentsProgress() {
    return this.userModel.updateMany(
      { role: 'STUDENT' },
      { 
        $set: { 
          xp: 0, 
          level: 1, 
          gems: 0, 
          streak: 0, 
          completedLessons: [], 
          claimedMissions: [],
          lastLessonId: null
        } 
      }
    ).exec();
  }

  async getLeaderboard(userIds?: string[], period: 'WEEK' | 'MONTH' | 'ALL' = 'WEEK') {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (period === 'WEEK') {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate.setDate(diff);
    } else if (period === 'MONTH') {
      startDate.setDate(1); // First day of current month
    } else {
      startDate.setFullYear(2000); // Far past for ALL time
    }

    const matchStage: any = { role: 'STUDENT' };
    if (userIds && userIds.length > 0) {
      matchStage._id = { $in: userIds.map(id => (typeof id === 'string' ? new (require('mongoose').Types.ObjectId)(id) : id)) };
    }

    const leaderboard = await this.userModel.aggregate([
      { $match: matchStage },
      {
        $project: {
          fullName: 1,
          avatar: 1,
          level: 1,
          totalXp: '$xp',
          lessonsXp: {
            $reduce: {
              input: {
                $filter: {
                  input: { $ifNull: ['$completedLessons', []] },
                  as: 'l',
                  cond: { $gte: ['$$l.completedAt', startDate] }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.xpGained', 0] }] }
            }
          },
          missionsXp: {
            $reduce: {
              input: {
                $filter: {
                  input: { $ifNull: ['$claimedMissions', []] },
                  as: 'm',
                  cond: { $gte: ['$$m.claimedAt', startDate] }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.xpReward', 0] }] }
            }
          }
        }
      },
      {
        $project: {
          fullName: 1,
          avatar: 1,
          level: 1,
          totalXp: 1,
          periodXp: { $add: [{ $ifNull: ['$lessonsXp', 0] }, { $ifNull: ['$missionsXp', 0] }] }
        }
      },
      { $sort: { periodXp: -1, totalXp: -1 } },
      { $limit: 100 }
    ]);

    return leaderboard;
  }

  async rename(userId: string, newName: string) {
    if (!isValidObjectId(userId)) return null;
    const user = await this.userModel.findById(userId).populate('inventory.itemId');
    if (!user) return null;

    const renameCount = user.renameCount || 0;
    const requiredCards = renameCount + 1;

    // Tìm thẻ đổi tên trong kho và tính tổng số lượng
    const cardInventory = user.inventory.filter(
      (inv: any) => inv.itemId && (inv.itemId.code === 'RENAME_CARD' || inv.itemId.category === 'RENAME_CARD' || inv.itemId.name === 'Thẻ đổi tên')
    );

    const totalCards = cardInventory.reduce((sum, inv) => sum + (inv.quantity || 1), 0);

    if (totalCards < requiredCards) {
      throw new Error(`Bạn cần ${requiredCards} Thẻ đổi tên để thực hiện việc này (Bạn đang có ${totalCards})`);
    }

    // Cập nhật tên và tăng số lần đổi
    user.fullName = newName;
    user.renameCount = renameCount + 1;

    // Tiêu hao thẻ khỏi kho
    let cardsToConsume = requiredCards;
    for (const inv of user.inventory) {
      const itemId: any = inv.itemId;
      if (itemId && (itemId.code === 'RENAME_CARD' || itemId.category === 'RENAME_CARD' || itemId.name === 'Thẻ đổi tên')) {
        const qty = inv.quantity || 1;
        if (qty >= cardsToConsume) {
          inv.quantity = qty - cardsToConsume;
          cardsToConsume = 0;
          break;
        } else {
          cardsToConsume -= qty;
          inv.quantity = 0;
        }
      }
    }

    // Xóa các item có quantity = 0
    user.inventory = user.inventory.filter(inv => (inv.quantity || 0) > 0);

    const savedUser = await user.save();
    return this.userModel.findById(savedUser._id)
      .select('-password')
      .populate('inventory.itemId')
      .populate('equippedItems.avatarId')
      .populate('equippedItems.frameId')
      .exec();
  }
  async getStudent360(id: string) {
    if (!isValidObjectId(id)) return null;
    const user = await this.userModel.findById(id)
      .populate({
        path: 'achievements.achievementId',
        model: 'Achievement'
      })
      .populate('inventory.itemId')
      .populate('equippedItems.avatarId')
      .populate('equippedItems.frameId')
      .lean();
    
    if (!user) return null;

    // Fetch lesson details for radar and activities
    const lessonIds = (user.completedLessons || []).map((l: any) => l.lessonId);
    const lessons = await this.lessonModel.find({ 
      _id: { $in: lessonIds } 
    });

    // Lấy toàn bộ danh sách môn học từ Category và cả các Lesson đã học để không sót môn nào
    const categorySubjects = await this.categoryModel.distinct('subject');
    const lessonSubjects = [...new Set(lessons.map(l => l.subject))];
    
    // Hợp nhất và loại bỏ trùng lặp, trim và lọc null/empty
    const allSubjectsSet = new Set([
      ...categorySubjects.filter(s => !!s).map(s => s.trim()),
      ...lessonSubjects.filter(s => !!s).map(s => s.trim())
    ]);
    
    let finalCategories = Array.from(allSubjectsSet);
    
    if (finalCategories.length === 0) {
      finalCategories = ['Toán học', 'Ngữ văn', 'Địa lý'];
    }

    // Tính toán dữ liệu năng lực dựa trên tỉ lệ câu đúng / tổng số câu hỏi
    const radarData = await this.calculateStudentRadarData(user, lessons, finalCategories);
    
    // Phân tích điểm mạnh, điểm yếu
    const sortedRadar = [...radarData].filter(d => d.A > 0).sort((a, b) => b.A - a.A);
    const strengths = sortedRadar.filter(d => d.A >= 75).map(d => d.subject);
    const weaknesses = sortedRadar.filter(d => d.A < 50).map(d => d.subject);

    // Calculate Timeline (Latest 10 activities)
    const activities = this.getStudentActivities(user, lessons);

    return {
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        level: user.level,
        xp: user.xp,
        gems: user.gems,
        streak: user.streak,
        avatar: user.avatar,
        equippedItems: user.equippedItems,
        createdAt: (user as any).createdAt,
      },
      stats: {
        totalLessons: user.completedLessons?.length || 0,
        totalAchievements: user.achievements?.length || 0,
        completionRate: user.completedLessons?.length > 0 
          ? Math.round((user.completedLessons.filter(l => l.score === l.total).length / user.completedLessons.length) * 100)
          : 0,
        strengths,
        weaknesses
      },
      radarData,
      activities,
      achievements: user.achievements
    };
  }

  private async calculateStudentRadarData(user: any, lessons: any[], categories: string[]) {
    const categoryScores: any = {};
    categories.forEach(cat => categoryScores[cat] = { totalCorrect: 0, totalQuestions: 0 });

    (user.completedLessons || []).forEach((cl: any) => {
      const lesson = lessons.find(l => l._id.toString() === cl.lessonId.toString());
      if (lesson && lesson.subject) {
        const subjectName = lesson.subject.trim();
        // Tìm category khớp nhất (không phân biệt hoa thường)
        const matchedCat = categories.find(c => c.toLowerCase() === subjectName.toLowerCase());
        
        if (matchedCat) {
          categoryScores[matchedCat].totalCorrect += Number(cl.score) || 0;
          categoryScores[matchedCat].totalQuestions += Number(cl.total) || 0;
        }
      }
    });

    return categories.map(cat => {
      const data = categoryScores[cat];
      const percentage = data.totalQuestions > 0 
        ? Math.round((data.totalCorrect / data.totalQuestions) * 100) 
        : 0;

      return {
        subject: cat,
        A: percentage,
        fullMark: 100
      };
    });
  }

  private getStudentActivities(user: any, lessons: any[]) {
    const activities: any[] = [];

    // Add completed lessons
    (user.completedLessons || []).forEach((cl: any) => {
      const lesson = lessons.find(l => l._id.toString() === cl.lessonId.toString());
      activities.push({
        type: 'LESSON',
        title: `Hoàn thành bài "${lesson?.title || 'Bài học'}"`,
        description: `Đạt ${cl.score}/${cl.total} điểm`,
        xp: cl.xpGained,
        date: cl.completedAt
      });
    });

    // Add achievements
    (user.achievements || []).forEach((a: any) => {
      activities.push({
        type: 'ACHIEVEMENT',
        title: `Nhận huy hiệu "${a.achievementId?.title || 'Thành tựu'}"`,
        description: a.achievementId?.description || 'Chúc mừng bạn!',
        xp: 200, // Fixed XP for achievement
        date: a.earnedAt
      });
    });

    // Sort by date descending
    return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }

  async toggleSavedPost(userId: string, postId: string) {
    if (!isValidObjectId(userId) || !isValidObjectId(postId)) return null;
    const user = await this.userModel.findById(userId);
    if (!user) return null;

    if (!user.savedPosts) user.savedPosts = [];
    const postIdObj = new (require('mongoose').Types.ObjectId)(postId);
    const index = user.savedPosts.findIndex(id => id.toString() === postIdObj.toString());

    if (index > -1) {
      user.savedPosts.splice(index, 1);
    } else {
      user.savedPosts.push(postIdObj as any);
    }

    return user.save();
  }
}
