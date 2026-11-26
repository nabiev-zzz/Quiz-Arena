import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityLearningService } from './community-learning.service';
interface AuthRequest { user: { id: string } }
@Controller('api/community/learning')
@UseGuards(JwtAuthGuard)
export class CommunityLearningController {
  constructor(private readonly learning: CommunityLearningService) {}
  @Get('groups') groups(@Request() r:AuthRequest,@Query('subject') s?:string){return this.learning.groups(r.user.id,s)}
  @Post('groups') createGroup(@Request() r:AuthRequest,@Body() b:{name?:string;description?:string;subject?:string;visibility?:string}){return this.learning.createGroup(r.user.id,b)}
  @Post('groups/:id/join') joinGroup(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.joinGroup(r.user.id,id)}
  @Get('groups/:id/messages') groupMessages(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.groupMessages(r.user.id,id)}
  @Post('groups/:id/messages') sendGroupMessage(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{body?:string}){return this.learning.sendGroupMessage(r.user.id,id,b?.body)}
  @Get('groups/:id/tasks') groupTasks(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.groupTasks(r.user.id,id)}
  @Post('groups/:id/tasks') createGroupTask(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{title?:string;description?:string;dueAt?:string}){return this.learning.createGroupTask(r.user.id,id,b)}
  @Post('group-tasks/:id/complete') completeGroupTask(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.completeGroupTask(r.user.id,id)}
  @Get('questions') questions(@Request() r:AuthRequest,@Query('subject') s?:string){return this.learning.questions(r.user.id,s)}
  @Post('questions') createQuestion(@Request() r:AuthRequest,@Body() b:{subject?:string;title?:string;body?:string;mediaKey?:string;mediaType?:string}){return this.learning.createQuestion(r.user.id,b)}
  @Get('questions/:id/answers') answers(@Param('id') id:string){return this.learning.answers(id)}
  @Post('questions/:id/answers') answer(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{body?:string}){return this.learning.answer(r.user.id,id,b?.body)}
  @Patch('questions/:id/answers/:answerId/best') accept(@Request() r:AuthRequest,@Param('id') id:string,@Param('answerId') a:string){return this.learning.acceptAnswer(r.user.id,id,a)}
  @Get('library') resources(@Request() r:AuthRequest,@Query('subject') s?:string){return this.learning.resources(r.user.id,s)}
  @Post('library') createResource(@Request() r:AuthRequest,@Body() b:{title?:string;description?:string;subject?:string;fileKey?:string;fileType?:string}){return this.learning.createResource(r.user.id,b)}
  @Post('library/:id/save') saveResource(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.saveResource(r.user.id,id)}
  @Post('library/:id/rate') rateResource(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{rating?:number}){return this.learning.rateResource(r.user.id,id,b?.rating)}
  @Get('library/:id/comments') resourceComments(@Param('id') id:string){return this.learning.resourceComments(id)}
  @Post('library/:id/comments') addResourceComment(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{body?:string}){return this.learning.addResourceComment(r.user.id,id,b?.body)}
  @Get('portfolio') portfolio(@Request() r:AuthRequest){return this.learning.portfolio(r.user.id)}
  @Post('portfolio') createPortfolio(@Request() r:AuthRequest,@Body() b:{kind?:string;title?:string;description?:string;linkUrl?:string}){return this.learning.createPortfolioItem(r.user.id,b)}
  @Get('mentors') mentors(){return this.learning.mentors()}
  @Post('mentors/profile') becomeMentor(@Request() r:AuthRequest,@Body() b:{headline?:string;subjects?:string;bio?:string}){return this.learning.becomeMentor(r.user.id,b)}
  @Post('mentors/:id/request') requestMentor(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{message?:string}){return this.learning.requestMentor(r.user.id,id,b?.message)}
  @Get('mentors/requests') mentorRequests(@Request() r:AuthRequest){return this.learning.mentorRequests(r.user.id)}
  @Patch('mentors/requests/:id') respondMentorRequest(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{status?:string}){return this.learning.respondMentorRequest(r.user.id,id,b?.status)}
  @Get('marathons') marathons(@Request() r:AuthRequest){return this.learning.marathons(r.user.id)}
  @Post('marathons') createMarathon(@Request() r:AuthRequest,@Body() b:{title?:string;description?:string;subject?:string;durationDays?:number}){return this.learning.createMarathon(r.user.id,b)}
  @Post('marathons/:id/join') joinMarathon(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.joinMarathon(r.user.id,id)}
  @Patch('marathons/:id/progress') updateMarathonProgress(@Request() r:AuthRequest,@Param('id') id:string,@Body() b:{progress?:number}){return this.learning.updateMarathonProgress(r.user.id,id,b?.progress)}

  @Get('library/:id/download') download(@Request() r:AuthRequest,@Param('id') id:string){return this.learning.resourceDownload(r.user.id,id)}
}
