import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../schemas/post.schema';

@Injectable()
export class PostsService {
  constructor(@InjectModel(Post.name) private postModel: Model<PostDocument>) {}

  async create(createPostDto: any): Promise<Post> {
    const createdPost = new this.postModel(createPostDto);
    return createdPost.save();
  }

  async findAll(query: any): Promise<Post[]> {
    const filter: any = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    else filter.status = 'APPROVED'; // Default to only showing approved posts

    return this.postModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Post | null> {
    return this.postModel.findById(id).exec();
  }

  async updateStatus(id: string, status: string): Promise<Post | null> {
    return this.postModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  async toggleLike(id: string, userId: string): Promise<Post | null> {
    const post = await this.postModel.findById(id);
    if (!post) return null;

    if (!post.likes) post.likes = [];

    const userIdObj = new Types.ObjectId(userId);
    const index = post.likes.findIndex(id => id.toString() === userIdObj.toString());
    
    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(userIdObj as any);
    }
    
    return post.save();
  }

  async addComment(id: string, commentData: any): Promise<Post | null> {
    return this.postModel.findByIdAndUpdate(
      id,
      { $push: { comments: { ...commentData, createdAt: new Date() } } },
      { new: true }
    ).exec();
  }

  async delete(id: string): Promise<any> {
    return this.postModel.findByIdAndDelete(id).exec();
  }
}
