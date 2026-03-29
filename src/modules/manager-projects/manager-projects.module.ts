import { Module } from '@nestjs/common';
import { ManagerProjectsController } from './manager-projects.controller';
import { ManagerProjectsService } from './manager-projects.service';

@Module({
  controllers: [ManagerProjectsController],
  providers: [ManagerProjectsService],
})
export class ManagerProjectsModule {}
