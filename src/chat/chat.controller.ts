/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { EventsGateway } from '../events/events.gateway';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /** Send a message */
  @Post('send')
  async sendMessage(
    @Request() req: AuthRequest,
    @Body() body: { receiverId: string; content: string },
  ) {
    const message = await this.chatService.sendMessage(
      req.user.userId,
      body.receiverId,
      body.content,
    );
    // Emit real-time event to receiver
    this.eventsGateway.emitToUser(body.receiverId, 'newMessage', message);
    return message;
  }

  /** Get all conversations for the current user */
  @Get('conversations')
  async getConversations(@Request() req: AuthRequest) {
    return this.chatService.getConversations(req.user.userId);
  }

  /** Get messages between current user and another user */
  @Get('messages/:userId')
  async getMessages(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.chatService.getMessages(
      req.user.userId,
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /** Mark messages from a user as read */
  @Put('read/:userId')
  async markAsRead(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
  ) {
    await this.chatService.markAsRead(req.user.userId, userId);
    return { success: true };
  }

  /** Get unread message count */
  @Get('unread-count')
  async getUnreadCount(@Request() req: AuthRequest) {
    const count = await this.chatService.getUnreadCount(req.user.userId);
    return { count };
  }

  /** Get allowed contacts for the current user */
  @Get('contacts')
  async getContacts(@Request() req: AuthRequest) {
    return this.chatService.getContacts(req.user.userId);
  }
}
