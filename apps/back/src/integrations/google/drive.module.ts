import { Module } from '@nestjs/common';
import { DriveService } from './drive.service';
import { AuthGoogleService } from './auth-google/auth-google.service';

@Module({
  providers: [DriveService, AuthGoogleService],
  exports: [DriveService],
})
export class DriveModule {}
