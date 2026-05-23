import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: any) {
    const { email, password, fullName, role } = registerDto;
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) throw new ConflictException('Email đã được sử dụng');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({ email, password: hashedPassword, fullName, role: role || 'STUDENT' });
    await user.save();

    const payload = { sub: user._id, email: user.email, role: user.role };
    const { password: _, ...userObj } = user.toObject();
    return { access_token: await this.jwtService.signAsync(payload), user: { ...userObj, id: user._id } };
  }

  async login(loginDto: any) {
    const { email, password } = loginDto;
    const user = await this.userModel.findOne({ email });
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');

    const payload = { sub: user._id, email: user.email, role: user.role };
    const { password: _, ...userObj } = user.toObject();
    return { access_token: await this.jwtService.signAsync(payload), user: { ...userObj, id: user._id } };
  }

  /**
   * Social login — verify token with Google or Facebook, then find/create user
   */
  async socialLogin(provider: 'google' | 'facebook', token: string, role = 'STUDENT') {
    let email: string;
    let fullName: string;
    let avatar: string | undefined;

    if (provider === 'google') {
      // Verify Google ID token
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!res.ok) throw new UnauthorizedException('Google token không hợp lệ');
      const data = await res.json() as { email?: string; name?: string; picture?: string; error?: string };
      if (data.error || !data.email) throw new UnauthorizedException('Google token không hợp lệ');
      email = data.email;
      fullName = data.name ?? email.split('@')[0];
      avatar = data.picture;
    } else {
      // Verify Facebook access token
      const res = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${token}`);
      if (!res.ok) throw new UnauthorizedException('Facebook token không hợp lệ');
      const data = await res.json() as { email?: string; name?: string; picture?: { data?: { url?: string } }; error?: unknown };
      if (data.error || !data.email) throw new UnauthorizedException('Facebook token không hợp lệ hoặc chưa cấp quyền email');
      email = data.email;
      fullName = data.name ?? email.split('@')[0];
      avatar = data.picture?.data?.url;
    }

    // Find or create user
    let user = await this.userModel.findOne({ email });
    if (!user) {
      user = new this.userModel({
        email,
        fullName,
        avatar,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        role,
        xp: 0, level: 1, gems: 0, streak: 0,
      });
      await user.save();
    } else if (avatar && !user.avatar) {
      user.avatar = avatar;
      await user.save();
    }

    const payload = { sub: user._id, email: user.email, role: user.role };
    const { password: _, ...userObj } = user.toObject();
    return { access_token: await this.jwtService.signAsync(payload), user: { ...userObj, id: user._id } };
  }

  async findById(id: string) {
    return this.userModel.findById(id)
      .select('-password')
      .populate('achievements.achievementId')
      .populate('inventory.itemId')
      .populate('equippedItems.avatarId')
      .populate('equippedItems.frameId');
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) throw new UnauthorizedException('Mật khẩu cũ không chính xác');
    user.password = await bcrypt.hash(newPass, 10);
    await user.save();
    return { message: 'Đổi mật khẩu thành công' };
  }
}
