import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

interface AuthRequest {
  user: { userId?: string; sub?: string; _id?: string; id?: string };
}

function getUserId(req: AuthRequest): string {
  return req.user.userId || req.user.sub || req.user._id || req.user.id || '';
}

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Register Expo push token */
  @Post('register-token')
  async registerToken(
    @Body('token') token: string,
    @Request() req: AuthRequest,
  ) {
    await this.notificationsService.registerToken(getUserId(req), token);
    return { success: true };
  }

  /** Remove push token on logout */
  @Post('remove-token')
  async removeToken(
    @Body('token') token: string,
    @Request() req: AuthRequest,
  ) {
    await this.notificationsService.removeToken(getUserId(req), token);
    return { success: true };
  }

  /** Get all notifications for current user */
  @Get()
  async getMyNotifications(@Request() req: AuthRequest) {
    return this.notificationsService.getForUser(getUserId(req));
  }

  /** Unread count */
  @Get('unread-count')
  async unreadCount(@Request() req: AuthRequest) {
    const count = await this.notificationsService.unreadCount(getUserId(req));
    return { count };
  }

  /** Mark all as read */
  @Patch('read-all')
  async markAllRead(@Request() req: AuthRequest) {
    await this.notificationsService.markAllRead(getUserId(req));
    return { success: true };
  }

  /** Mark single notification as read */
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.notificationsService.markRead(id, getUserId(req));
  }

  /** Broadcast push notification to a target group */
  @Post('push')
  async broadcast(
    @Body() body: { title: string; body: string; target?: string; type?: string },
  ) {
    return this.notificationsService.sendBroadcast(
      body.title,
      body.body ?? '',
      body.target ?? 'all',
      body.type ?? 'general',
    );
  }
}