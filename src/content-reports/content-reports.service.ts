import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ContentReport,
  ContentReportDocument,
} from '../schemas/content-report.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContentReportsService {
  constructor(
    @InjectModel(ContentReport.name)
    private reportModel: Model<ContentReportDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: Partial<ContentReport>): Promise<ContentReport> {
    const report = await this.reportModel.create(dto);

    // Notify admins about new content report
    void this.notificationsService.notifyAdmins(
      '🚨 Báo cáo nội dung mới',
      `Có một bài viết vừa bị báo cáo vi phạm. Vui lòng kiểm tra.`,
      'general',
      { reportId: (report as any)._id?.toString() },
    );

    return report;
  }

  async findAll(query: {
    status?: string;
    reason?: string;
  }): Promise<ContentReport[]> {
    const filter: Record<string, string> = {};
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.reason && query.reason !== 'ALL') filter.reason = query.reason;
    return this.reportModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<ContentReport | null> {
    return this.reportModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
  }

  async delete(id: string): Promise<ContentReport | null> {
    return this.reportModel.findByIdAndDelete(id).exec();
  }
}