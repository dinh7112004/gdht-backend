import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  async sendOtp(@Body() body: { email: string }) {
    await this.passwordResetService.sendRegisterOtp(body.email);
    return { message: 'Mã OTP đã được gửi' };
  }

  @Post('register')
  async register(@Body() registerDto: any) {
    const { otp, ...rest } = registerDto;
    await this.passwordResetService.verifyRegisterOtp(rest.email, otp);
    return this.authService.register(rest);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: any) {
    return this.authService.login(loginDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('social')
  async socialLogin(@Body() body: { provider: 'google' | 'facebook'; token: string; role?: string }) {
    return this.authService.socialLogin(body.provider, body.token, body.role ?? 'STUDENT');
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.findById(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async changePassword(@Request() req, @Body() data: any) {
    return this.authService.changePassword(req.user.userId, data.oldPassword, data.newPassword);
  }
}
