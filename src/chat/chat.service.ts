/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { Class, ClassDocument } from '../schemas/class.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Validate that two users are allowed to chat:
   * - Student can only chat with teachers of classes they've joined
   * - Teacher can chat with students in their classes
   */
  async validatePermission(
    senderId: string,
    receiverId: string,
  ): Promise<boolean> {
    if (
      !Types.ObjectId.isValid(senderId) ||
      !Types.ObjectId.isValid(receiverId)
    )
      return false;

    const [sender, receiver] = await Promise.all([
      this.userModel.findById(senderId).select('role').exec(),
      this.userModel.findById(receiverId).select('role').exec(),
    ]);
    if (!sender || !receiver) return false;

    // Admin can chat with anyone, and anyone can chat with admin
    if (sender.role === 'ADMIN' || receiver.role === 'ADMIN') return true;

    const sId = new Types.ObjectId(senderId);
    const rId = new Types.ObjectId(receiverId);

    if (sender.role === 'STUDENT') {
      // Student can only chat with teachers of classes they've joined
      const sharedClass = await this.classModel
        .findOne({
          studentIds: sId,
          $or: [{ teacherId: rId }, { coTeacherIds: rId }],
        })
        .exec();
      return !!sharedClass;
    } else if (sender.role === 'TEACHER') {
      // Teacher can chat with students in their classes
      const sharedClass = await this.classModel
        .findOne({
          $or: [{ teacherId: sId }, { coTeacherIds: sId }],
          studentIds: rId,
        })
        .exec();
      return !!sharedClass;
    }

    return false;
  }

  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
  ): Promise<any> {
    const allowed = await this.validatePermission(senderId, receiverId);
    if (!allowed) {
      throw new ForbiddenException(
        'Bạn không có quyền nhắn tin với người dùng này',
      );
    }

    const message = new this.messageModel({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      content: content.trim(),
    });
    const saved = await message.save();

    // Populate sender info for real-time emit
    const populated = await this.messageModel
      .findById(saved._id)
      .populate('senderId', 'fullName avatar')
      .populate('receiverId', 'fullName avatar')
      .exec();

    return populated;
  }

  /**
   * Get list of conversations for a user (one entry per unique contact, with last message)
   */
  async getConversations(userId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const uId = new Types.ObjectId(userId);

    // Find all messages where user is sender or receiver
    const messages = await this.messageModel
      .find({ $or: [{ senderId: uId }, { receiverId: uId }] })
      .sort({ createdAt: -1 })
      .populate('senderId', 'fullName avatar role')
      .populate('receiverId', 'fullName avatar role')
      .exec();

    // Group by conversation partner
    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
      const other =
        msg.senderId._id.toString() === userId ? msg.receiverId : msg.senderId;
      const otherId = other._id.toString();
      if (!conversationMap.has(otherId)) {
        const unreadCount = await this.messageModel
          .countDocuments({
            senderId: new Types.ObjectId(otherId),
            receiverId: uId,
            isRead: false,
          })
          .exec();

        conversationMap.set(otherId, {
          userId: otherId,
          fullName: (other as any).fullName,
          avatar: (other as any).avatar,
          role: (other as any).role,
          lastMessage: msg.content,
          lastMessageAt: (msg as any).createdAt,
          unreadCount,
        });
      }
    }

    return Array.from(conversationMap.values());
  }

  /**
   * Get messages between two users (paginated, newest last)
   */
  async getMessages(
    userId: string,
    otherUserId: string,
    page = 1,
    limit = 50,
  ): Promise<any[]> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(otherUserId))
      return [];

    const uId = new Types.ObjectId(userId);
    const oId = new Types.ObjectId(otherUserId);

    const messages = await this.messageModel
      .find({
        $or: [
          { senderId: uId, receiverId: oId },
          { senderId: oId, receiverId: uId },
        ],
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', 'fullName avatar')
      .exec();

    // Return in chronological order
    return messages.reverse();
  }

  /**
   * Mark all messages from otherUserId to userId as read
   */
  async markAsRead(userId: string, otherUserId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(otherUserId))
      return;

    await this.messageModel
      .updateMany(
        {
          senderId: new Types.ObjectId(otherUserId),
          receiverId: new Types.ObjectId(userId),
          isRead: false,
        },
        { $set: { isRead: true } },
      )
      .exec();
  }

  /**
   * Get total unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    return this.messageModel
      .countDocuments({
        receiverId: new Types.ObjectId(userId),
        isRead: false,
      })
      .exec();
  }

  /**
   * Get allowed contacts for a user:
   * - Student: teachers of their classes
   * - Teacher: students in their classes
   */
  async getContacts(userId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(userId)) return [];

    const user = await this.userModel.findById(userId).select('role').exec();
    if (!user) return [];

    const uId = new Types.ObjectId(userId);

    if (user.role === 'STUDENT') {
      // Get all classes the student has joined
      const classes = await this.classModel
        .find({ studentIds: uId })
        .populate('teacherId', 'fullName avatar role')
        .populate('coTeacherIds', 'fullName avatar role')
        .exec();

      const teacherMap = new Map<string, any>();
      for (const cls of classes) {
        const teacher = cls.teacherId as any;
        if (teacher && teacher._id) {
          teacherMap.set(teacher._id.toString(), {
            _id: teacher._id.toString(),
            fullName: teacher.fullName,
            avatar: teacher.avatar,
            role: teacher.role,
            className: cls.name,
          });
        }
        for (const co of (cls.coTeacherIds || []) as any[]) {
          if (co && co._id) {
            teacherMap.set(co._id.toString(), {
              _id: co._id.toString(),
              fullName: co.fullName,
              avatar: co.avatar,
              role: co.role,
              className: cls.name,
            });
          }
        }
      }
      return Array.from(teacherMap.values());
    } else if (user.role === 'ADMIN') {
      // Admin can chat with all users except themselves
      const users = await this.userModel
        .find({ _id: { $ne: uId } })
        .select('fullName avatar role')
        .exec();
      return users.map((u: any) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        avatar: u.avatar,
        role: u.role,
      }));
    } else if (user.role === 'TEACHER') {
      // Get all students in teacher's classes
      const classes = await this.classModel
        .find({ $or: [{ teacherId: uId }, { coTeacherIds: uId }] })
        .populate('studentIds', 'fullName avatar role')
        .exec();

      const studentMap = new Map<string, any>();
      for (const cls of classes) {
        for (const student of (cls.studentIds || []) as any[]) {
          if (student && student._id) {
            studentMap.set(student._id.toString(), {
              _id: student._id.toString(),
              fullName: student.fullName,
              avatar: student.avatar,
              role: student.role,
              className: cls.name,
            });
          }
        }
      }
      return Array.from(studentMap.values());
    }

    return [];
  }
}
