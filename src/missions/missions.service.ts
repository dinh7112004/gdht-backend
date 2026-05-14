import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Mission, MissionDocument } from '../schemas/mission.schema';

@Injectable()
export class MissionsService {
  constructor(@InjectModel(Mission.name) private missionModel: Model<MissionDocument>) {}

  async findAll() {
    return this.missionModel.find().exec();
  }

  async findByType(type: string) {
    return this.missionModel.find({ type, isActive: true }).exec();
  }

  async create(data: any) {
    const newMission = new this.missionModel(data);
    return newMission.save();
  }

  async update(id: string, data: any) {
    return this.missionModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string) {
    return this.missionModel.findByIdAndDelete(id).exec();
  }
}
