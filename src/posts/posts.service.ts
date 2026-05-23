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
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    else if (!query.status) filter.status = 'APPROVED'; // Default for public API
    // if status === 'ALL', no status filter — returns everything (admin use)

    return this.postModel
      .find(filter)
      .populate('likes', 'name avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Post | null> {
    return this.postModel.findById(id).exec();
  }

  async updateStatus(id: string, status: string): Promise<Post | null> {
    return this.postModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
  }

  async toggleLike(id: string, userId: string): Promise<Post | null> {
    const post = await this.postModel.findById(id);
    if (!post) return null;

    if (!post.likes) post.likes = [];

    const userIdObj = new Types.ObjectId(userId);
    const index = post.likes.findIndex(
      (likeId) => likeId.toString() === userIdObj.toString(),
    );

    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(userIdObj);
    }

    return post.save();
  }

  async addComment(id: string, commentData: any): Promise<Post | null> {
    return this.postModel
      .findByIdAndUpdate(
        id,
        { $push: { comments: { ...commentData, createdAt: new Date() } } },
        { new: true },
      )
      .exec();
  }

  async delete(id: string): Promise<any> {
    return this.postModel.findByIdAndDelete(id).exec();
  }
}

