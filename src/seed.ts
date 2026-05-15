// @ts-nocheck
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const lessonModel = app.get(getModelToken('Lesson'));
  const quizModel = app.get(getModelToken('Quiz'));
  const userModel = app.get(getModelToken('User'));
  const classModel = app.get(getModelToken('Class'));
  const categoryModel = app.get(getModelToken('Category'));
  const achievementModel = app.get(getModelToken('Achievement'));
  const itemModel = app.get(getModelToken('Item'));
  const missionModel = app.get(getModelToken('Mission'));

  console.log('Seeding data...');

  // 1. Create Achievements
  // 1. Create Achievements
  await achievementModel.deleteMany({});
  const achievements = await achievementModel.create([
    {
      code: 'FIRST_LESSON',
      title: 'Người mới bắt đầu',
      description: 'Hoàn thành bài học đầu tiên.',
      icon: 'https://cdn-icons-png.flaticon.com/512/610/610333.png',
      level: 1,
      category: 'LEARNING'
    },
    {
      code: 'STREAK_7',
      title: 'Chăm chỉ',
      description: 'Duy trì chuỗi 7 ngày học tập.',
      icon: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
      level: 5,
      category: 'LEARNING'
    },
    {
      code: 'PERFECT_SCORE_5',
      title: 'Trạng Nguyên',
      description: 'Đạt điểm tuyệt đối trong 5 bài học.',
      icon: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png',
      level: 10,
      category: 'SPECIAL'
    }
  ]);

  // 2. Create Items
  await itemModel.deleteMany({});
  const items = await itemModel.create([
    {
      name: 'EXP x2',
      description: 'Nhân đôi XP nhận được trong 1 giờ.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png',
      category: 'BOOST',
      price: 200,
      color: '#3B82F6'
    },
    {
      name: 'Gợi ý',
      description: 'Mở khóa gợi ý cho 1 câu hỏi.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
      category: 'BOOST',
      price: 50,
      color: '#F59E0B'
    },
    {
      name: 'Bảo vệ',
      description: 'Bảo vệ chuỗi ngày nếu quên học.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/610/610333.png',
      category: 'BOOST',
      price: 150,
      color: '#10B981'
    },
    {
      name: 'Đổi tên',
      description: 'Cho phép thay đổi tên hiển thị.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/10433/10433048.png',
      category: 'OTHER',
      price: 500,
      color: '#EF4444'
    }
  ]);

  // 3. Create Missions
  await missionModel.deleteMany({});
  await missionModel.create([
    {
      title: 'Học giả chăm chỉ',
      description: 'Hoàn thành 3 bài học bất kỳ',
      type: 'DAILY',
      requirementType: 'LESSONS_COUNT',
      requirementValue: 3,
      xpReward: 50,
      gemReward: 5
    },
    {
      title: 'Chinh phục toán học',
      description: 'Trả lời đúng 50 câu hỏi Quiz',
      type: 'WEEKLY',
      requirementType: 'QUIZ_COUNT',
      requirementValue: 50,
      xpReward: 500,
      gemReward: 50
    },
    {
      title: 'Chuỗi ngày rực rỡ',
      description: 'Duy trì Streak 7 ngày liên tiếp',
      type: 'STREAK',
      requirementType: 'STREAK_COUNT',
      requirementValue: 7,
      xpReward: 100,
      gemReward: 0
    }
  ]);

  // 1. Create Categories
  await categoryModel.deleteMany({});
  const categories = await categoryModel.create([
    {
      name: 'Ca dao',
      description: 'Lời ru và những bài học cuộc sống qua ca dao tục ngữ.',
      imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=400',
      isFeatured: true,
      order: 1
    },
    {
      name: 'Truyện Kiều',
      description: 'Khám phá toán học và văn chương trong tác phẩm của Nguyễn Du.',
      imageUrl: 'https://images.unsplash.com/photo-1599708137303-90432773295c?q=80&w=400',
      isFeatured: true,
      order: 2
    },
    {
      name: 'Lễ hội',
      description: 'Hình học và thống kê trong các lễ hội truyền thống.',
      imageUrl: 'https://images.unsplash.com/photo-1590333746438-d81ff137a5c3?q=80&w=400',
      isFeatured: true,
      order: 3
    },
    {
      name: 'Danh nhân',
      description: 'Những con số lịch sử và cuộc đời các vị anh hùng dân tộc.',
      imageUrl: 'https://images.unsplash.com/photo-1621245033772-e0eaa8710279?q=80&w=400',
      isFeatured: true,
      order: 4
    }
  ]);

  // 2. Create Admin & Test User
  const hashedPassword = await bcrypt.hash('123456', 10);
  await userModel.deleteMany({});
  const users = await userModel.create([
    {
      email: 'student@test.com',
      password: hashedPassword,
      fullName: 'Minh Học Sinh',
      role: 'STUDENT',
      level: 5,
      xp: 1200,
      gems: 35,
      streak: 7,
      achievements: [
        { achievementId: achievements[0]._id, level: 1, earnedAt: new Date() },
        { achievementId: achievements[1]._id, level: 5, earnedAt: new Date() }
      ],
      inventory: [
        { itemId: items[0]._id, quantity: 3 },
        { itemId: items[1]._id, quantity: 5 },
        { itemId: items[2]._id, quantity: 2 },
        { itemId: items[3]._id, quantity: 1 }
      ]
    },
    {
      email: 'teacher@test.com',
      password: hashedPassword,
      fullName: 'Cô Mai',
      role: 'TEACHER'
    },
    {
      email: 'admin@test.com',
      password: hashedPassword,
      fullName: 'Quản trị viên',
      role: 'ADMIN'
    }
  ]);

  const studentId = users[0]._id;
  const teacherId = users[1]._id;

  // 3. Create Lessons
  await lessonModel.deleteMany({});
  const lessons = await lessonModel.create([
    {
      title: 'Bài toán từ ca dao tục ngữ',
      description: 'Khám phá các phép tính ẩn sau những câu ca dao quen thuộc.',
      category: 'Ca dao',
      difficulty: 'Dễ',
      estimatedMinutes: 15,
      xpReward: 100,
      imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=400'
    }
  ]);

  // 4. Create Classes
  await classModel.deleteMany({});
  await classModel.create([
    {
      name: 'Lớp 5A',
      code: 'CLASS5A',
      teacherId: teacherId,
      studentIds: [studentId],
      averageProgress: 78,
      assignedLessons: [lessons[0]._id]
    }
  ]);

  console.log('Seed completed!');
  await app.close();
}

bootstrap();
