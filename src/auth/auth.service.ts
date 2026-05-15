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
    
    // Check if user exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new this.userModel({
      email,
      password: hashedPassword,
      fullName,
      role: role || 'STUDENT',
    });

    await user.save();

    // Return token
    const payload = { sub: user._id, email: user.email, role: user.role };
    const { password: _, ...userObj } = user.toObject();

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        ...userObj,
        id: user._id,
      },
    };
  }

  async login(loginDto: any) {
    const { email, password } = loginDto;
    console.log(`[DEBUG] Login attempt for: ${email}`);
    
    const user = await this.userModel.findOne({ email });
    if (!user) {
      console.log(`[DEBUG] User NOT found for email: ${email}`);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    console.log(`[DEBUG] User found: ${user.fullName} (${user.role})`);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`[DEBUG] Password MISMATCH for user: ${email}`);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    console.log(`[DEBUG] Login SUCCESS for: ${email}`);

    const payload = { sub: user._id, email: user.email, role: user.role };
    
    // Tạo bản sao user object và xóa password an toàn
    const { password: _, ...userObj } = user.toObject();

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        ...userObj,
        id: user._id,
      },
    };
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id)
      .select('-password')
      .populate('achievements.achievementId')
      .populate('inventory.itemId')
      .populate('equippedItems.avatarId')
      .populate('equippedItems.frameId');
    return user;
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) throw new UnauthorizedException('Mật khẩu cũ không chính xác');

    const hashedNew = await bcrypt.hash(newPass, 10);
    user.password = hashedNew;
    await user.save();

    return { message: 'Đổi mật khẩu thành công' };
  }
}
