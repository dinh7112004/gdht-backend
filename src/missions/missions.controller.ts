import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MissionsService } from './missions.service';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  findAll(@Query('type') type?: string) {
    if (type && type !== 'Tất cả') {
      const typeMap: any = {
        'Hàng ngày': 'DAILY',
        'Hàng tuần': 'WEEKLY',
        'Sự kiện': 'SPECIAL'
      };
      return this.missionsService.findByType(typeMap[type] || type);
    }
    return this.missionsService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.missionsService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.missionsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.missionsService.delete(id);
  }
}
