import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Item, ItemDocument } from '../schemas/item.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(Item.name) private itemModel: Model<ItemDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<ItemDocument[]> {
    return this.itemModel.find({ isAvailable: true }).exec();
  }

  async adminFindAll(): Promise<ItemDocument[]> {
    return this.itemModel.find().exec();
  }

  async create(data: any): Promise<ItemDocument> {
    const newItem = new this.itemModel(data);
    return newItem.save();
  }

  async update(id: string, data: any): Promise<ItemDocument | null> {
    return this.itemModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<any> {
    return this.itemModel.findByIdAndDelete(id).exec();
  }

  async buyItem(userId: string, itemId: string): Promise<UserDocument> {
    const item = await this.itemModel.findById(itemId).exec();
    if (!item) throw new BadRequestException('Vật phẩm không tồn tại');
    if (!item.isAvailable) throw new BadRequestException('Vật phẩm hiện không mở bán');

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    // Check balance
    if (item.currency === 'GEMS') {
      if (user.gems < item.price) throw new BadRequestException('Bạn không đủ Gems');
      user.gems -= item.price;
    } else {
      if (user.xp < item.price) throw new BadRequestException('Bạn không đủ XP');
      user.xp -= item.price;
    }

    // Add to inventory
    // Đảm bảo không có item lỗi (itemId undefined) làm sập app
    const inventoryItem = user.inventory.find(i => i.itemId && i.itemId.toString() === itemId);
    
    if (inventoryItem) {
      inventoryItem.quantity += 1;
    } else {
      user.inventory.push({
        itemId: itemId,
        quantity: 1,
        acquiredAt: new Date()
      });
    }

    // Tiện tay dọn dẹp các item lỗi trong kho (nếu có)
    user.inventory = user.inventory.filter(i => !!i.itemId);

    return user.save();
  }

  async useItem(userId: string, itemId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    const inventoryIndex = user.inventory.findIndex(i => i.itemId && i.itemId.toString() === itemId);
    if (inventoryIndex === -1 || user.inventory[inventoryIndex].quantity <= 0) {
      throw new BadRequestException('Bạn không có vật phẩm này');
    }

    const item = await this.itemModel.findById(itemId).exec();
    if (!item) throw new BadRequestException('Vật phẩm không tồn tại');

    // Perform action based on category/metadata
    let message = 'Sử dụng thành công';
    let isConsumable = true;
    
    switch (item.category) {
      case 'AVATAR':
        isConsumable = false;
        user.equippedItems.avatarId = user.equippedItems.avatarId === itemId ? undefined : itemId;
        message = user.equippedItems.avatarId ? `Đã trang bị ${item.name}` : `Đã tháo ${item.name}`;
        break;
      case 'DECORATION':
        isConsumable = false;
        user.equippedItems.frameId = user.equippedItems.frameId === itemId ? undefined : itemId;
        message = user.equippedItems.frameId ? `Đã trang bị ${item.name}` : `Đã tháo ${item.name}`;
        break;
      case 'BOOST':
        if (item.code === 'DOUBLE_XP' || item.name.includes('XP')) {
          user.doubleXpUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          message = 'Đã kích hoạt Nhân đôi XP trong 1 giờ!';
        } else if (item.code === 'STREAK_FREEZE' || item.name.includes('Bảo vệ')) {
          user.streakFreezeActive = true;
          message = 'Đã kích hoạt Khiên bảo vệ chuỗi học tập!';
        } else if (item.name.includes('Gợi ý')) {
          user.hintsCount = (user.hintsCount || 0) + 3;
          message = 'Đã nhận được thêm 3 gợi ý cho bài tập!';
        }
        break;
      case 'OTHER':
        if (item.code === 'RENAME_CARD' || item.name.includes('Đổi tên')) {
          message = 'Mời bạn quay lại trang cá nhân để thực hiện đổi tên mới.';
        }
        break;
      default:
        message = `Bạn đã sử dụng ${item.name}`;
    }

    // Decrement quantity only for consumables
    if (isConsumable) {
      user.inventory[inventoryIndex].quantity -= 1;
      if (user.inventory[inventoryIndex].quantity <= 0) {
        user.inventory.splice(inventoryIndex, 1);
      }
    }

    await user.save();
    
    // Populate before returning to ensure UI updates correctly
    const populatedUser = await this.userModel.findById(userId)
      .populate('inventory.itemId')
      .populate('equippedItems.avatarId')
      .populate('equippedItems.frameId')
      .exec();

    return { success: true, message, user: populatedUser };
  }
}
