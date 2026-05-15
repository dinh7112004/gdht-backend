import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subject, SubjectDocument } from '../schemas/subject.schema';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
  ) {}

  async findAll(): Promise<Subject[]> {
    return this.subjectModel.find().sort({ order: 1, name: 1 }).exec();
  }

  async create(data: Partial<Subject>): Promise<Subject> {
    const created = new this.subjectModel(data);
    return created.save();
  }

  async update(id: string, data: Partial<Subject>): Promise<Subject | null> {
    return this.subjectModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<Subject | null> {
    return this.subjectModel.findByIdAndDelete(id).exec();
  }

  // Khởi tạo dữ liệu mẫu nếu chưa có
  async seed() {
    const count = await this.subjectModel.countDocuments();
    if (count === 0) {
      const defaultSubjects = [
        "Toán học", "Ngữ văn", "Lịch sử", "Địa lý", 
        "Khoa học", "Tiếng Anh", "Văn hóa", "Nghệ thuật"
      ];
      for (const name of defaultSubjects) {
        await this.create({ name });
      }
    }
  }
}
