import { Module } from '@nestjs/common';
import { AdminController } from './v1/admin.controller';
import { AdminRepository } from './v1/admin.repository';
import { AdminService } from './v1/admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
