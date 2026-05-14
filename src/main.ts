import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS so the mobile app/web can call the API
  app.enableCors();
  
  // Serve static files from the uploads directory
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
// Trigger restart

