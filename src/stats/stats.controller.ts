import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  async getDashboard(@Query('period') period: string) {
    return this.statsService.getDashboardStats(period);
  }

  @Get('reports')
  async getReports() {
    return this.statsService.getReportsStats();
  }
}
