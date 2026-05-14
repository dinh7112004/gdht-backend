import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Post, PostDocument } from '../schemas/post.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

  async getReportsStats() {
    const totalStudents = await this.userModel.countDocuments({ role: 'STUDENT' });
    const students = await this.userModel.find({ role: 'STUDENT' });

    const radarData = await this.calculateRadarData();
    const hourlyActivity = await this.calculateHourlyActivity();

    const activeLast7Days = await this.userModel.countDocuments({
      role: 'STUDENT',
      updatedAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    const retentionRate = totalStudents > 0 ? (activeLast7Days / totalStudents) * 100 : 0;

    const totalXp = students.reduce((acc, user) => acc + (user.xp || 0), 0);
    const avgStudyTime = 25.5; 

    return {
      radarData,
      hourlyActivity,
      kpis: {
        retentionRate,
        avgStudyTime,
        totalXp,
        xpGrowth: "+12.5%"
      }
    };
  }

  private async calculateRadarData() {
    const allSubjects = await this.lessonModel.distinct('subject');
    const categories = allSubjects.filter(s => !!s);
    const finalCategories = categories.length > 0 ? categories : ['Toán học', 'Văn hóa', 'Lịch sử', 'Kỹ năng', 'Sáng tạo'];

    const stats = await this.userModel.aggregate([
      { $unwind: "$completedLessons" },
      {
        $lookup: {
          from: "lessons",
          let: { lessonId: { $toObjectId: "$completedLessons.lessonId" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$lessonId"] } } }
          ],
          as: "lessonDetail"
        }
      },
      { $unwind: "$lessonDetail" },
      {
        $group: {
          _id: "$lessonDetail.subject",
          avgScore: { $avg: { $divide: ["$completedLessons.score", "$completedLessons.total"] } }
        }
      }
    ]);

    return finalCategories.map(cat => {
      const match = stats.find(s => s._id === cat);
      return {
        subject: cat,
        A: match ? Math.round(match.avgScore * 150) : 60 + Math.random() * 20,
        B: 120,
        fullMark: 150
      };
    });
  }

  private async calculateHourlyActivity() {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, value: 0 }));
    const activity = await this.userModel.aggregate([
      { $unwind: "$completedLessons" },
      {
        $group: {
          _id: { $hour: "$completedLessons.completedAt" },
          count: { $sum: 1 }
        }
      }
    ]);

    activity.forEach(a => {
      if (a._id !== null) {
        hours[a._id].value = a.count;
      }
    });

    return [6, 9, 12, 15, 18, 21, 0].map(h => hours[h]);
  }

  async getDashboardStats(period: string = '7 NGÀY') {
    const totalStudents = await this.userModel.countDocuments({ role: 'STUDENT' });
    const students = await this.userModel.find({ role: 'STUDENT' });
    
    const totalXp = students.reduce((acc, user) => acc + (user.xp || 0), 0);
    
    const totalLessonsCount = await this.lessonModel.countDocuments();
    let avgCompletionRate = 0;
    if (totalStudents > 0 && totalLessonsCount > 0) {
      const completedCounts = students.map(s => (s.completedLessons?.length || 0));
      const totalCompleted = completedCounts.reduce((a, b) => a + b, 0);
      avgCompletionRate = (totalCompleted / (totalStudents * totalLessonsCount)) * 100;
    }

    const aiInteractions = Math.floor(totalXp / 5000);

    const growthData = await this.getGrowthData(period);
    const categoryDistribution = await this.getCategoryDistribution();

    const recentPosts = await this.postModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    return {
      kpis: [
        { title: "Tổng học sinh", value: totalStudents.toLocaleString(), change: "+12%", isUp: true, color: "#10b981", target: 100, progress: Math.min((totalStudents / 50) * 100, 100) },
        { title: "Tỷ lệ hoàn thành", value: `${avgCompletionRate.toFixed(1)}%`, change: "+5%", isUp: true, color: "#3b82f6", target: 90, progress: Math.min(avgCompletionRate, 100) },
        { title: "Kinh nghiệm (XP)", value: this.formatXp(totalXp), change: "+8%", isUp: true, color: "#f59e0b", target: 100, progress: Math.min((totalXp / 10000) * 100, 100) },
        { title: "Tương tác AI", value: aiInteractions.toLocaleString(), change: "+15%", isUp: true, color: "#a855f7", target: 100, progress: 10 },
      ],
      growthData,
      categoryDistribution,
      recentPosts
    };
  }

  private formatXp(xp: number): string {
    if (xp >= 1000000) return (xp / 1000000).toFixed(1) + 'M';
    if (xp >= 1000) return (xp / 1000).toFixed(1) + 'K';
    return xp.toString();
  }

  private async getGrowthData(period: string) {
    const now = new Date();
    const result: any[] = [];
    
    if (period === '1 NĂM') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = `Th ${d.getMonth() + 1}`;
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const users = await this.userModel.countDocuments({
          role: 'STUDENT',
          createdAt: { $lt: endOfMonth }
        });
        const lessons = await this.lessonModel.countDocuments({
          createdAt: { $lt: endOfMonth }
        });
        result.push({ name: label, users, lessons });
      }
    } else if (period === '30 NGÀY') {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const label = `Tuần ${4 - i}`;
        const users = await this.userModel.countDocuments({
          role: 'STUDENT',
          createdAt: { $lt: d }
        });
        const lessons = await this.lessonModel.countDocuments({
          createdAt: { $lt: d }
        });
        result.push({ name: label, users, lessons });
      }
    } else {
      const currentDay = now.getDay(); 
      const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayDiff);
      monday.setHours(0, 0, 0, 0);

      const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const endOfDay = new Date(d);
        endOfDay.setDate(d.getDate() + 1);
        const users = await this.userModel.countDocuments({
          role: 'STUDENT',
          createdAt: { $lt: endOfDay }
        });
        const lessons = await this.lessonModel.countDocuments({
          createdAt: { $lt: endOfDay }
        });
        result.push({ name: dayLabels[i], users, lessons });
      }
    }
    return result;
  }

  private async getCategoryDistribution() {
    const lessons = await this.lessonModel.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const colors = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#a855f7'];
    if (lessons.length === 0) {
      return [{ name: 'Chưa có bài học', value: 1, color: '#cbd5e1' }];
    }
    return lessons.map((l, idx) => ({
      name: l._id || 'Khác',
      value: l.count,
      color: colors[idx % colors.length]
    }));
  }
}
