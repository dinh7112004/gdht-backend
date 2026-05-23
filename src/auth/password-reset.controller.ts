import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PasswordResetService } from './password-reset.service';
import { ForgotDto } from './dto/forgot.dto';
import { ResetDto } from './dto/reset.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';

@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('forgot')
  async forgot(@Body() body: ForgotDto) {
    await this.passwordResetService.sendForgotOtp(body.email);
    return { message: 'Nếu email tồn tại, chúng tôi đã gửi mã xác nhận.' };
  }

  @Post('verify-reset-otp')
  async verifyResetOtp(@Body() body: VerifyResetOtpDto) {
    const token = await this.passwordResetService.verifyForgotOtp(body.email, body.otp);
    return { token };
  }

  @Get('reset-password')
  resetPasswordPage(@Query('token') token: string, @Res() res: Response) {
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Đặt lại mật khẩu - GDHT</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f4f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 420px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { color: #2E7D32; font-size: 22px; margin-bottom: 8px; }
    p { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input { width: 100%; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 15px; margin-bottom: 16px; outline: none; transition: border-color .2s; }
    input:focus { border-color: #2E7D32; }
    button { width: 100%; background: #2E7D32; color: #fff; border: none; padding: 15px; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; }
    button:hover { background: #1b5e20; }
    .msg { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 14px; text-align: center; display: none; }
    .msg.success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .msg.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Đặt lại mật khẩu</h1>
    <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
    <form id="form">
      <label>Mật khẩu mới</label>
      <input type="password" id="password" placeholder="Ít nhất 6 ký tự" required minlength="6" />
      <label>Xác nhận mật khẩu</label>
      <input type="password" id="confirm" placeholder="Nhập lại mật khẩu" required />
      <button type="submit" id="btn">Đặt lại mật khẩu</button>
    </form>
    <div class="msg" id="msg"></div>
  </div>
  <script>
    const token = ${JSON.stringify(token || '')};
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      const msg = document.getElementById('msg');
      const btn = document.getElementById('btn');
      msg.style.display = 'none';
      if (password !== confirm) {
        msg.className = 'msg error'; msg.textContent = 'Mật khẩu xác nhận không khớp'; msg.style.display = 'block'; return;
      }
      btn.disabled = true; btn.textContent = 'Đang xử lý...';
      try {
        const res = await fetch('/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
        const data = await res.json();
        if (res.ok) {
          msg.className = 'msg success'; msg.textContent = '✓ Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.';
          document.getElementById('form').style.display = 'none';
        } else {
          msg.className = 'msg error'; msg.textContent = data.message || 'Đặt lại mật khẩu thất bại'; btn.disabled = false; btn.textContent = 'Đặt lại mật khẩu';
        }
        msg.style.display = 'block';
      } catch {
        msg.className = 'msg error'; msg.textContent = 'Lỗi kết nối. Vui lòng thử lại.'; msg.style.display = 'block'; btn.disabled = false; btn.textContent = 'Đặt lại mật khẩu';
      }
    });
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Post('reset')
  async reset(@Body() body: ResetDto) {
    await this.passwordResetService.resetPassword(body.token, body.password);
    return { message: 'Đổi mật khẩu thành công' };
  }
}
