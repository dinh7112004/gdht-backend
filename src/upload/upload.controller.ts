import { Controller, Post, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { GoogleDriveService } from './google-drive.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Post('image')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    const url = await this.googleDriveService.uploadFile(file);
    return {
      url: url,
    };
  }
}
