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
      androidUrl: 'https://expo.dev/accounts/faxriyorkk/projects/QUIZ-ARENA/builds/7375d1b9-6b57-46d0-bdaf-52459e28eb99',
      releaseNotes: 'Hujjatdan AI test yaratish va Android fayl yuklash yaxshilandi.',
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
