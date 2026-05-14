import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { GoogleDriveService } from './google-drive.service';

@Module({
  controllers: [UploadController],
  providers: [GoogleDriveService],
  exports: [GoogleDriveService],
})
export class UploadModule {}
