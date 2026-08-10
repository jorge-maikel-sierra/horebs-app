import { Module } from '@nestjs/common';
import { InformesController } from './informes.controller';
import { InformesService } from './informes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}
