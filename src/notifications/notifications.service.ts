/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class NotificationsService {
  private expo = new Expo();

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Save Expo push token for a user */
  async registerToken(userId: string, token: string): Promise<void> {
    if (!Expo.isExpoPushToken(token)) return;
    await this.userModel
      .findByIdAndUpdate(userId, { $addToSet: { pushTokens: token } })
      .exec();
  }

  /** Remove a push token (e.g. on logout) */
  async removeToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $pull: { pushTokens: token } })
      .exec();
  }

  /** Create a notification record and send push to the user */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    type = 'general',
    data: Record<string, unknown> = {},
  ): Promise<void> {
    // Persist in DB
    await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      title,
      body,
      type,
      data,
    });

    // Send push notification
    const user = await this.userModel
      .findById(userId)
      .select('pushTokens')
      .exec();
    const tokens: string[] = (user as any)?.pushTokens || [];
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t))
      .map((token) => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data,
      }));

    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error('Push send error:', err);
      }
    }
  }

  /** Send to multiple users at once */
  async sendToMany(
    userIds: string[],
    title: string,
    body: string,
    type = 'general',
    data: Record<string, unknown> = {},
  ): Promise<void> {
    await Promise.all(
      userIds.map((id) => this.sendToUser(id, title, body, type, data)),
    );
  }

  /** Get notifications for a user (newest first) */
  async getForUser(userId: string, limit = 50) {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /** Mark a single notification as read */
  async markRead(notificationId: string, userId: string) {
    return this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, userId: new Types.ObjectId(userId) },
        { isRead: true },
        { new: true },
      )
      .exec();
  }

  /** Mark all notifications as read for a user */
  async markAllRead(userId: string) {
    return this.notificationModel
      .updateMany(
        { userId: new Types.ObjectId(userId), isRead: false },
        { isRead: true },
      )
      .exec();
  }

  /** Count unread notifications */
  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId: new Types.ObjectId(userId), isRead: false })
      .exec();
  }

  /** Notify all admins */
  async notifyAdmins(
    title: string,
    body: string,
    type = 'general',
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const admins = await this.userModel.find({ role: 'ADMIN' }).select('_id').exec();
    const adminIds = admins.map((a) => (a._id as Types.ObjectId).toString());
    await this.sendToMany(adminIds, title, body, type, data);
  }

  /**
   * Broadcast to a target group:
   * - 'all'      → all users
   * - 'students' → role STUDENT
   * - 'teachers' → role TEACHER
   * - 'inactive' → STUDENT not logged in for 3+ days
   */
  async sendBroadcast(
    title: string,
    body: string,
    target: string,
    type = 'general',
  ): Promise<{ sent: number }> {
    // If target looks like a MongoDB ObjectId, send to that specific user
    if (Types.ObjectId.isValid(target)) {
      await this.sendToUser(target, title, body, type);
      return { sent: 1 };
    }

    let query: Record<string, unknown> = {};
    if (target === 'students') {
      query = { role: 'STUDENT' };
    } else if (target === 'teachers') {
      query = { role: 'TEACHER' };
    } else if (target === 'inactive') {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      query = {
        role: 'STUDENT',
        $or: [
          { lastLoginAt: { $lt: threeDaysAgo } },
          { lastLoginAt: { $exists: false } },
        ],
      };
    }
    // 'all' → no filter = everyone

    const users = await this.userModel.find(query).select('_id').exec();
    const userIds = users.map((u) => (u._id as Types.ObjectId).toString());
    await this.sendToMany(userIds, title, body, type);
    return { sent: userIds.length };
  }
}