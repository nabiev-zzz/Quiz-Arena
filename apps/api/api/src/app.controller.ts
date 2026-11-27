import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('app/version')
  getAppVersion() {
    return {
      latestVersion: '1.1.2',
      minSupportedVersion: '1.1.2',
      androidUrl: 'https://github.com/nabiev-zzz/Quiz-Arena/releases/latest',
      releaseNotes: 'Hujjatdan AI test yaratish va Android fayl yuklash yaxshilandi.',
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
