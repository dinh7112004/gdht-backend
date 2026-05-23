import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsService } from './content-reports.service';
import {
  ContentReport,
  ContentReportSchema,
} from '../schemas/content-report.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContentReport.name, schema: ContentReportSchema },
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ContentReportsController],
  providers: [ContentReportsService],
  exports: [ContentReportsService],
})
export class ContentReportsModule {}