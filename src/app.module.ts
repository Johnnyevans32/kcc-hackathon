import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IDVService } from './idc.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, IDVService],
})
export class AppModule {}
