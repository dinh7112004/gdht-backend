import { Controller, Get, Post, Body, Query, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async create(@Body() createPostDto: any) {
    return this.postsService.create(createPostDto);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.postsService.updateStatus(id, status);
  }

  @Patch(':id/like')
  async toggleLike(@Param('id') id: string, @Body('userId') userId: string) {
    return this.postsService.toggleLike(id, userId);
  }

  @Post(':id/comment')
  async addComment(@Param('id') id: string, @Body() commentData: any) {
    return this.postsService.addComment(id, commentData);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.postsService.delete(id);
  }
}
