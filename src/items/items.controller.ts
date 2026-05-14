import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async findAll() {
    return this.itemsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin')
  async adminFindAll() {
    return this.itemsService.adminFindAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() data: any) {
    return this.itemsService.create(data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.itemsService.update(id, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.itemsService.delete(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('buy/:id')
  async buyItem(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user._id;
    return this.itemsService.buyItem(userId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('use/:id')
  async useItem(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user._id;
    return this.itemsService.useItem(userId, id);
  }
}
