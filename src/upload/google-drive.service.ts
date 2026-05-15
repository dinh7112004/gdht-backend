import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import * as stream from 'stream';

@Injectable()
export class GoogleDriveService {
  private drive;
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');

    if (clientId && clientSecret && refreshToken) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          'https://developers.google.com/oauthplayground'
        );

        oauth2Client.setCredentials({
          refresh_token: refreshToken
        });

        this.drive = google.drive({ version: 'v3', auth: oauth2Client });
        this.logger.log('Google Drive Service initialized with OAuth2');
      } catch (error) {
        this.logger.error('Failed to initialize Google Drive Service', error);
      }
    } else {
      this.logger.warn('Google OAuth2 credentials not found in .env. Uploads will fail.');
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!this.drive) {
      throw new Error('Google Drive Service not initialized. Check OAuth2 credentials in .env');
    }

    const folderId = this.configService.get<string>('GOOGLE_DRIVE_FOLDER_ID');
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: `${Date.now()}-${file.originalname}`,
          parents: folderId ? [folderId] : [],
        },
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
        fields: 'id',
      });

      const fileId = response.data.id;

      // Make file public
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Return a direct link
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    } catch (error: any) {
      this.logger.error('Error uploading to Google Drive', error.message);
      if (error.response) {
        this.logger.error('Google API Error Response:', error.response.data);
      }
      throw error;
    }
  }
}
