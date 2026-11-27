import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('app/version')
  getAppVersion() {
    return {
      latestVersion: '1.1.3',
      minSupportedVersion: '1.1.2',
      androidUrl: 'https://expo.dev/artifacts/eas/jAU-hMzNCjrZbywkufm70xdot001tsrpagsgy00LSnI.apk',
      releaseNotes: 'Hujjatdan AI test yaratish, fayl yuklash jarayoni va test savollarini tahrirlash yaxshilandi.',
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}