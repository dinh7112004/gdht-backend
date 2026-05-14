import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Achievement, AchievementDocument } from '../schemas/achievement.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private eventsGateway: EventsGateway
  ) {}

  async findAll(): Promise<Achievement[]> {
    return this.achievementModel.find().exec();
  }

  async findOne(id: string): Promise<Achievement | null> {
    return this.achievementModel.findById(id).exec();
  }

  async claim(userId: string, achievementId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    const achievement = await this.achievementModel.findById(achievementId).exec();
    if (!achievement) throw new BadRequestException('Huy hiệu không tồn tại');

    // Check if already claimed
    const alreadyClaimed = user.achievements?.some(a => a.achievementId.toString() === achievementId);
    if (alreadyClaimed) throw new BadRequestException('Bạn đã nhận huy hiệu này rồi');

    // Validate requirements
    let currentProgress = 0;
    switch (achievement.requirementType) {
      case 'LESSONS_COUNT':
        currentProgress = user.completedLessons?.length || 0;
        break;
      case 'XP_COUNT':
        currentProgress = user.xp || 0;
        break;
      case 'STREAK_COUNT':
        currentProgress = user.streak || 0;
        break;
      case 'PERFECT_QUIZZES':
        currentProgress = user.completedLessons?.filter(l => l.score === l.total).length || 0;
        break;
      default:
        throw new BadRequestException('Loại yêu cầu không hợp lệ');
    }

    if (currentProgress < achievement.requirementValue) {
      throw new BadRequestException(`Bạn chưa đạt đủ điều kiện. Cần ${achievement.requirementValue}, hiện có ${currentProgress}`);
    }

    // Award achievement
    if (!user.achievements) user.achievements = [];
    user.achievements.push({
      achievementId: achievement._id as any,
      earnedAt: new Date(),
      level: achievement.level
    });

    // Award bonuses
    user.xp += achievement.xpReward || 0;
    user.gems += achievement.gemReward || 0;

    await user.save();

    return {
      success: true,
      message: `Chúc mừng! Bạn đã nhận được huy hiệu "${achievement.title}"`,
      xpReward: achievement.xpReward,
      gemReward: achievement.gemReward,
      user
    };
  }

  async create(data: any): Promise<Achievement> {
    const newAchievement = new this.achievementModel(data);
    const saved = await newAchievement.save();
    this.eventsGateway.emitDataChange('achievementUpdated', saved);
    return saved;
  }

  async update(id: string, data: any): Promise<Achievement | null> {
    const updated = await this.achievementModel.findByIdAndUpdate(id, data, { new: true }).exec();
    this.eventsGateway.emitDataChange('achievementUpdated', updated);
    return updated;
  }

  async delete(id: string): Promise<any> {
    const deleted = await this.achievementModel.findByIdAndDelete(id).exec();
    this.eventsGateway.emitDataChange('achievementUpdated', { id, deleted: true });
    return deleted;
  }
}
