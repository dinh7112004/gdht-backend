import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quiz, QuizDocument } from '../schemas/quiz.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    private eventsGateway: EventsGateway
  ) {}

  async findByLesson(lessonId: string): Promise<Quiz[]> {
    return this.quizModel.find({ lessonId }).populate('lessonId').exec();
  }

  async findAll(): Promise<Quiz[]> {
    return this.quizModel.find().populate('lessonId').exec();
  }

  async findOne(id: string): Promise<Quiz | null> {
    return this.quizModel.findById(id).populate('lessonId').exec();
  }

  async create(data: any): Promise<QuizDocument> {
    const newQuiz = new this.quizModel(data);
    const saved = await newQuiz.save();
    this.eventsGateway.emitDataChange('quizUpdated', saved);
    return saved;
  }

  async update(id: string, data: any): Promise<QuizDocument | null> {
    const updated = await this.quizModel.findByIdAndUpdate(id, data, { new: true }).exec();
    this.eventsGateway.emitDataChange('quizUpdated', updated);
    return updated;
  }

  async delete(id: string): Promise<any> {
    const deleted = await this.quizModel.findByIdAndDelete(id).exec();
    this.eventsGateway.emitDataChange('quizUpdated', { id, deleted: true });
    return deleted;
  }
}
