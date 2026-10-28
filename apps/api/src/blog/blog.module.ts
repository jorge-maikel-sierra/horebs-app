import { Module } from '@nestjs/common';
import { BlogAdminController } from './blog-admin.controller';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BlogController, BlogAdminController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
