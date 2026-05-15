import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LessonsModule } from './lessons/lessons.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { User, UserSchema } from './schemas/user.schema';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { EventsModule } from './events/events.module';
import { PostsModule } from './posts/posts.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ItemsModule } from './items/items.module';
import { MissionsModule } from './missions/missions.module';
import { UploadModule } from './upload/upload.module';
import { SubjectsModule } from './subjects/subjects.module';

import { StatsModule } from './stats/stats.module';

// Triggering restart to ensure PostsModule is loaded
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/gdht'),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
    LessonsModule,
    QuizzesModule,
    AuthModule,
    ClassesModule,
    UsersModule,
    CategoriesModule,
    EventsModule,
    PostsModule,
    AchievementsModule,
    ItemsModule,
    MissionsModule,
    StatsModule,
    UploadModule,
    SubjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
