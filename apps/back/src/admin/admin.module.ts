import { Module } from '@nestjs/common';
import { AdminController } from './v1/admin.controller';
import { AdminQueryRepository } from './v1/admin-query.repository';
import { AdminRepository } from './v1/admin.repository';
import { AdminService } from './v1/admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, AdminQueryRepository],
})
export class AdminModule {}
