import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Lesson, LessonSchema } from '../schemas/lesson.schema';
import { Achievement, AchievementSchema } from '../schemas/achievement.schema';
import { EventsModule } from '../events/events.module';
import { ClassesModule } from '../classes/classes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Category, CategorySchema } from '../schemas/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Achievement.name, schema: AchievementSchema }
    ]),
    EventsModule,
    forwardRef(() => ClassesModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
