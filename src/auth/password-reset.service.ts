import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordReset, PasswordResetDocument } from './password-reset.schema';
import { EmailOtp, EmailOtpDocument } from './email-otp.schema';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(PasswordReset.name) private resetModel: Model<PasswordResetDocument>,
    @InjectModel(EmailOtp.name) private otpModel: Model<EmailOtpDocument>,
    private usersService: UsersService,
  ) {}

  private createTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendRegisterOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    await this.otpModel.deleteMany({ email, type: 'register' });
    await this.otpModel.create({ email, otp, expiresAt, type: 'register' });

    const transporter = this.createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to: email,
      subject: 'Mã xác thực đăng ký - GDHT',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2E7D32;">Xác thực email đăng ký</h2>
          <p>Mã OTP của bạn là:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #2E7D32; padding: 16px 0;">${otp}</div>
          <p style="color: #64748b;">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    });

    this.logger.log(`OTP sent to ${email}`);
  }

  async verifyRegisterOtp(email: string, otp: string): Promise<boolean> {
    const entry = await this.otpModel.findOne({ email, type: 'register' });
    if (!entry) throw new BadRequestException('Mã OTP không tồn tại hoặc đã hết hạn');
    if (entry.expiresAt.getTime() < Date.now()) {
      await this.otpModel.deleteMany({ email, type: 'register' });
      throw new BadRequestException('Mã OTP đã hết hạn');
    }
    if (entry.otp !== otp) throw new BadRequestException('Mã OTP không chính xác');
    await this.otpModel.deleteMany({ email, type: 'register' });
    return true;
  }

  async sendForgotOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('Email này chưa được đăng ký trong hệ thống');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    await this.otpModel.deleteMany({ email, type: 'forgot' });
    await this.otpModel.create({ email, otp, expiresAt, type: 'forgot' });

    const transporter = this.createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to: email,
      subject: 'Mã khôi phục mật khẩu - GDHT',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2E7D32;">Khôi phục mật khẩu</h2>
          <p>Mã xác nhận của bạn là:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #2E7D32; padding: 16px 0;">${otp}</div>
          <p style="color: #64748b;">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    });

    this.logger.log(`Forgot password OTP sent to ${email}`);
  }

  async verifyForgotOtp(email: string, otp: string): Promise<string> {
    const entry = await this.otpModel.findOne({ email, type: 'forgot' });
    if (!entry) throw new BadRequestException('Mã OTP không tồn tại hoặc đã hết hạn');
    if (entry.expiresAt.getTime() < Date.now()) {
      await this.otpModel.deleteMany({ email, type: 'forgot' });
      throw new BadRequestException('Mã OTP đã hết hạn');
    }
    if (entry.otp !== otp) throw new BadRequestException('Mã OTP không chính xác');
    await this.otpModel.deleteMany({ email, type: 'forgot' });

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút để đổi mật khẩu
    await this.resetModel.create({ user: user._id, token, expiresAt });

    return token;
  }

  async sendResetEmail(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.resetModel.create({ user: user._id, token, expiresAt });

    const transporter = this.createTransporter();
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${backendUrl}/auth/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to: user.email,
      subject: 'Đặt lại mật khẩu - GDHT',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2E7D32;">Đặt lại mật khẩu</h2>
          <p>Nhấn vào nút bên dưới để đặt lại mật khẩu của bạn:</p>
          <a href="${resetLink}" style="display: inline-block; background: #2E7D32; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Đặt lại mật khẩu</a>
          <p style="color: #64748b; margin-top: 16px;">Link có hiệu lực trong <strong>1 giờ</strong>.</p>
        </div>
      `,
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  async resetPassword(token: string, newPassword: string) {
    const entry = await this.resetModel.findOne({ token }).exec();
    if (!entry || entry.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.usersService.findOne(String(entry.user));
    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    await this.usersService.update(String(entry.user), { password: newPassword });
    await this.resetModel.deleteOne({ _id: entry._id }).exec();
  }
}
