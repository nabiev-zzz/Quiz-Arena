import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ZcWalletService } from './zc-wallet.service';
import { CommunityStorageService } from './community-storage.service';

@Injectable()
export class CommunityLearningService {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly storage: CommunityStorageService, private readonly wallet: ZcWalletService) {}
  private validOwnedMediaKey(userId:string,key:string,type:string) {
    const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf','application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
    const extension=extensions[type];
    return Boolean(extension&&new RegExp(`^community/${userId}/[a-f0-9-]{36}\\.${extension}$`,'i').test(key));
  }
  private clean(value: unknown, max: number, label: string, required = true) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (required && !text) throw new BadRequestException(label + 'ni kiriting');
    if (text.length > max) throw new BadRequestException(label + ' juda uzun');
    return text;
  }

  async groups(viewerId: string, subject?: string) {
    return this.db.query(`SELECT g.id,g.name,g.description,g.subject,g.visibility,g.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url,(SELECT COUNT(*)::int FROM community_group_members m WHERE m.group_id=g.id) AS members_count,EXISTS(SELECT 1 FROM community_group_members m WHERE m.group_id=g.id AND m.user_id=$1) AS joined,EXISTS(SELECT 1 FROM community_group_members m WHERE m.group_id=g.id AND m.user_id=$1 AND m.role='owner') AS is_owner FROM community_groups g JOIN users u ON u.id=g.owner_id WHERE u.status='active' AND (g.visibility='public' OR EXISTS(SELECT 1 FROM community_group_members m WHERE m.group_id=g.id AND m.user_id=$1)) AND ($2::text IS NULL OR g.subject=$2) ORDER BY g.created_at DESC LIMIT 60`, [viewerId, subject || null]);
  }
  async createGroup(ownerId: string, input: { name?: string; description?: string; subject?: string; visibility?: string }) {
    const name=this.clean(input.name,90,'Guruh nomi'), description=this.clean(input.description,600,'Tavsif',false), subject=this.clean(input.subject,60,'Fan');
    const visibility=input.visibility==='private'?'private':'public';
    return this.db.transaction(async manager => {
      const [group]=await manager.query(`INSERT INTO community_groups(owner_id,name,description,subject,visibility) VALUES($1,$2,$3,$4,$5) RETURNING id,name,description,subject,visibility,created_at`,[ownerId,name,description,subject,visibility]);
      await manager.query(`INSERT INTO community_group_members(group_id,user_id,role) VALUES($1,$2,'owner') ON CONFLICT DO NOTHING`,[group.id,ownerId]);
      return {...group,members_count:1,joined:true,is_owner:true};
    });
  }
  async joinGroup(userId:string,groupId:string) {
    const [group]=await this.db.query('SELECT id,visibility FROM community_groups WHERE id=$1',[groupId]);
    if(!group) throw new NotFoundException('Guruh topilmadi');
    if(group.visibility==='private') throw new BadRequestException('Yopiq guruhga qo‘shilish uchun taklif kerak');
    await this.db.query('INSERT INTO community_group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[groupId,userId]);
    const [count]=await this.db.query('SELECT COUNT(*)::int AS members_count FROM community_group_members WHERE group_id=$1',[groupId]);
    return {joined:true,membersCount:count.members_count};
  }

  async questions(viewerId:string,subject?:string) {
    const rows=await this.db.query(`SELECT q.id,q.subject,q.title,q.body,q.media_key,q.media_type,q.status,q.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url,(SELECT COUNT(*)::int FROM community_answers a WHERE a.question_id=q.id) AS answers_count,q.best_answer_id,(q.author_id=$1) AS is_own FROM community_questions q JOIN users u ON u.id=q.author_id WHERE u.status='active' AND ($2::text IS NULL OR q.subject=$2) ORDER BY (q.status='open') DESC,q.created_at DESC LIMIT 80`,[viewerId,subject||null]);
    return rows.map((row:any)=>({...row,media_url:row.media_key?this.storage.sign('GET',row.media_key,900):null}));
  }
  async createQuestion(authorId:string,input:{subject?:string;title?:string;body?:string;mediaKey?:string;mediaType?:string}) {
    const subject=this.clean(input.subject,60,'Fan'),title=this.clean(input.title,140,'Savol sarlavhasi'),body=this.clean(input.body,3000,'Savol tafsiloti');
    const mediaKey=input.mediaKey||null,mediaType=input.mediaType||null;
    const allowed=['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if(mediaKey&&(!allowed.includes(mediaType||'')||!this.validOwnedMediaKey(authorId,mediaKey,mediaType||'')))throw new BadRequestException('Savol fayli noto‘g‘ri');
    const [question]=await this.db.query('INSERT INTO community_questions(author_id,subject,title,body,media_key,media_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,subject,title,body,media_key,media_type,status,created_at',[authorId,subject,title,body,mediaKey,mediaType]);
    return {...question,media_url:mediaKey?this.storage.sign('GET',mediaKey,900):null};
  }
  async answers(questionId:string) {
    const [exists]=await this.db.query('SELECT id FROM community_questions WHERE id=$1',[questionId]);
    if(!exists) throw new NotFoundException('Savol topilmadi');
    return this.db.query(`SELECT a.id,a.body,a.is_best,a.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url FROM community_answers a JOIN users u ON u.id=a.author_id WHERE a.question_id=$1 AND u.status='active' ORDER BY a.is_best DESC,a.created_at ASC`,[questionId]);
  }
  async answer(userId:string,questionId:string,bodyValue:unknown) {
    const body=this.clean(bodyValue,2000,'Javob');
    const [question]=await this.db.query('SELECT id,status FROM community_questions WHERE id=$1',[questionId]);
    if(!question) throw new NotFoundException('Savol topilmadi');
    if(question.status!=='open') throw new BadRequestException('Bu savolga javob qabul qilinmayapti');
    const [answer]=await this.db.query('INSERT INTO community_answers(question_id,author_id,body) VALUES($1,$2,$3) RETURNING id,question_id,body,is_best,created_at',[questionId,userId,body]);
    return answer;
  }
  async acceptAnswer(ownerId:string,questionId:string,answerId:string) {
    const result = await this.db.transaction(async manager=>{
      const [q]=await manager.query('SELECT id,author_id,best_answer_id FROM community_questions WHERE id=$1 FOR UPDATE',[questionId]);
      if(!q) throw new NotFoundException('Savol topilmadi');
      if(q.author_id!==ownerId) throw new BadRequestException('Eng yaxshi javobni faqat savol muallifi tanlaydi');
      if(q.best_answer_id&&q.best_answer_id!==answerId) throw new BadRequestException('Boshqa eng yaxshi javob avval tanlangan');
      const [a]=await manager.query('SELECT id,author_id FROM community_answers WHERE id=$1 AND question_id=$2',[answerId,questionId]);
      if(!a) throw new NotFoundException('Javob topilmadi');
      if(a.author_id===ownerId) throw new BadRequestException('O‘zingizning javobingizni eng yaxshi deb belgilay olmaysiz');
      const newlyAccepted=!q.best_answer_id;
      if(newlyAccepted){
        await manager.query('UPDATE community_answers SET is_best=(id=$1) WHERE question_id=$2',[answerId,questionId]);
        await manager.query("UPDATE community_questions SET best_answer_id=$1,status='answered' WHERE id=$2",[answerId,questionId]);
        await manager.query('UPDATE users SET xp=xp+15, level=GREATEST(1,FLOOR((xp+15)/100.0)::int+1) WHERE id=$1',[a.author_id]);
      }
      return {accepted:true,answerId,answerAuthorId:a.author_id,newlyAccepted};
    });
    await this.wallet.credit(result.answerAuthorId,5,'Hamjamiyatdagi eng yaxshi javob',`community-best-answer:${answerId}`);
    return {accepted:true,answerId,xpAwarded:result.newlyAccepted?15:0,zcAwarded:5};
  }
  async resources(viewerId:string,subject?:string) {
    return this.db.query(`SELECT r.id,r.title,r.description,r.subject,r.file_type,r.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url,EXISTS(SELECT 1 FROM community_resource_saves s WHERE s.resource_id=r.id AND s.user_id=$1) AS saved,(SELECT COUNT(*)::int FROM community_resource_saves s WHERE s.resource_id=r.id) AS saves_count,COALESCE((SELECT ROUND(AVG(rt.rating)::numeric,1) FROM community_resource_ratings rt WHERE rt.resource_id=r.id),0) AS average_rating,(SELECT rt.rating FROM community_resource_ratings rt WHERE rt.resource_id=r.id AND rt.user_id=$1) AS my_rating,(SELECT COUNT(*)::int FROM community_resource_ratings rt WHERE rt.resource_id=r.id) AS ratings_count FROM community_resources r JOIN users u ON u.id=r.author_id WHERE u.status='active' AND ($2::text IS NULL OR r.subject=$2) ORDER BY r.created_at DESC LIMIT 80`,[viewerId,subject||null]);
  }
  async createResource(authorId:string,input:{title?:string;description?:string;subject?:string;fileKey?:string;fileType?:string}) {
    const title=this.clean(input.title,140,'Material nomi'),description=this.clean(input.description,600,'Tavsif',false),subject=this.clean(input.subject,60,'Fan'),fileKey=this.clean(input.fileKey,500,'Fayl'),fileType=this.clean(input.fileType,100,'Fayl turi');
    const allowed=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
    if(!allowed.includes(fileType)||!this.validOwnedMediaKey(authorId,fileKey,fileType)) throw new BadRequestException('Faqat o‘zingiz yuklagan PDF yoki Word faylni joylang');
    const [resource]=await this.db.query('INSERT INTO community_resources(author_id,title,description,subject,file_key,file_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,title,description,subject,file_type,created_at',[authorId,title,description,subject,fileKey,fileType]);
    return resource;
  }
  async saveResource(userId:string,resourceId:string) {
    const [resource]=await this.db.query('SELECT id FROM community_resources WHERE id=$1',[resourceId]);
    if(!resource) throw new NotFoundException('Material topilmadi');
    await this.db.query('INSERT INTO community_resource_saves(resource_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[resourceId,userId]);
    const [count]=await this.db.query('SELECT COUNT(*)::int AS saves_count FROM community_resource_saves WHERE resource_id=$1',[resourceId]);
    return {saved:true,savesCount:count.saves_count};
  }
  async resourceDownload(userId:string,resourceId:string) {
    const [resource]=await this.db.query('SELECT file_key,file_type,author_id FROM community_resources WHERE id=$1',[resourceId]);
    if(!resource) throw new NotFoundException('Material topilmadi');
    return {url:this.storage.sign('GET',resource.file_key,900),fileType:resource.file_type};
  }
  async groupMessages(userId:string,groupId:string) {
    const [member]=await this.db.query('SELECT id FROM community_group_members WHERE group_id=$1 AND user_id=$2',[groupId,userId]);
    if(!member) throw new BadRequestException('Guruh suhbatini ko‘rish uchun a’zo bo‘ling');
    return this.db.query(`SELECT * FROM (SELECT m.id,m.body,m.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url FROM community_group_messages m JOIN users u ON u.id=m.author_id WHERE m.group_id=$1 AND u.status='active' ORDER BY m.created_at DESC LIMIT 150) recent ORDER BY created_at ASC`,[groupId]);
  }
  async sendGroupMessage(userId:string,groupId:string,rawBody:unknown) {
    const body=this.clean(rawBody,2000,'Xabar');
    const [member]=await this.db.query('SELECT id FROM community_group_members WHERE group_id=$1 AND user_id=$2',[groupId,userId]);
    if(!member) throw new BadRequestException('Xabar yuborish uchun guruh a’zosi bo‘ling');
    const [message]=await this.db.query('INSERT INTO community_group_messages(group_id,author_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at',[groupId,userId,body]);
    return message;
  }

  async rateResource(userId:string,resourceId:string,ratingValue:unknown) {
    const rating=Number(ratingValue);
    if(!Number.isInteger(rating)||rating<1||rating>5) throw new BadRequestException('Baho 1 dan 5 gacha bo‘lishi kerak');
    const [resource]=await this.db.query('SELECT id FROM community_resources WHERE id=$1',[resourceId]);
    if(!resource) throw new NotFoundException('Material topilmadi');
    await this.db.query('INSERT INTO community_resource_ratings(resource_id,user_id,rating) VALUES($1,$2,$3) ON CONFLICT(resource_id,user_id) DO UPDATE SET rating=EXCLUDED.rating,created_at=now()',[resourceId,userId,rating]);
    const [summary]=await this.db.query('SELECT ROUND(AVG(rating)::numeric,1) AS average_rating,COUNT(*)::int AS ratings_count FROM community_resource_ratings WHERE resource_id=$1',[resourceId]);
    return {myRating:rating,averageRating:Number(summary.average_rating),ratingsCount:summary.ratings_count};
  }

  async resourceComments(resourceId:string) {
    const [resource]=await this.db.query('SELECT id FROM community_resources WHERE id=$1',[resourceId]);
    if(!resource) throw new NotFoundException('Material topilmadi');
    return this.db.query(`SELECT c.id,c.body,c.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url FROM community_resource_comments c JOIN users u ON u.id=c.author_id WHERE c.resource_id=$1 AND u.status='active' ORDER BY c.created_at ASC LIMIT 100`,[resourceId]);
  }
  async addResourceComment(userId:string,resourceId:string,rawBody:unknown) {
    const body=this.clean(rawBody,1000,'Izoh');
    const [resource]=await this.db.query('SELECT id FROM community_resources WHERE id=$1',[resourceId]);
    if(!resource) throw new NotFoundException('Material topilmadi');
    const [comment]=await this.db.query('INSERT INTO community_resource_comments(resource_id,author_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at',[resourceId,userId,body]);
    return comment;
  }

  async portfolio(viewerId:string) {
    return this.db.query(`SELECT p.id,p.kind,p.title,p.description,p.link_url,p.created_at,u.id AS author_id,u.display_name,u.username,u."avatarUrl" AS avatar_url,(p.author_id=$1) AS is_own FROM community_portfolio_items p JOIN users u ON u.id=p.author_id WHERE u.status='active' ORDER BY p.created_at DESC LIMIT 100`,[viewerId]);
  }
  async createPortfolioItem(authorId:string,input:{kind?:string;title?:string;description?:string;linkUrl?:string}) {
    const kind=input.kind==='certificate'||input.kind==='skill'?input.kind:'project';
    const title=this.clean(input.title,140,'Portfolio nomi'),description=this.clean(input.description,800,'Tavsif',false),linkUrl=this.clean(input.linkUrl,500,'Havola',false);
    if(linkUrl&&!/^https:\/\//i.test(linkUrl)) throw new BadRequestException('Havola https:// bilan boshlanishi kerak');
    const [item]=await this.db.query('INSERT INTO community_portfolio_items(author_id,kind,title,description,link_url) VALUES($1,$2,$3,$4,$5) RETURNING id,kind,title,description,link_url,created_at',[authorId,kind,title,description,linkUrl||null]);
    return item;
  }
  async mentors() {
    return this.db.query(`SELECT m.user_id,u.display_name,u.username,u."avatarUrl" AS avatar_url,u.xp,m.headline,m.subjects,m.bio,m.accepting,(SELECT COUNT(*)::int FROM community_mentorship_requests r WHERE r.mentor_id=m.user_id AND r.status='accepted') AS students_count FROM community_mentor_profiles m JOIN users u ON u.id=m.user_id WHERE u.status='active' AND m.accepting=true ORDER BY students_count DESC,u.xp DESC LIMIT 60`);
  }
  async becomeMentor(userId:string,input:{headline?:string;subjects?:string;bio?:string}) {
    const headline=this.clean(input.headline,140,'Mentor sarlavhasi'),subjects=this.clean(input.subjects,300,'Fanlar'),bio=this.clean(input.bio,600,'Tavsif',false);
    await this.db.query(`INSERT INTO community_mentor_profiles(user_id,headline,subjects,bio) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET headline=EXCLUDED.headline,subjects=EXCLUDED.subjects,bio=EXCLUDED.bio,accepting=true`,[userId,headline,subjects,bio]);
    return {enabled:true};
  }
  async requestMentor(learnerId:string,mentorId:string,messageValue:unknown) {
    if(learnerId===mentorId) throw new BadRequestException('O‘zingizga mentorlik so‘rovi yubora olmaysiz');
    const message=this.clean(messageValue,600,'So‘rov matni');
    const [mentor]=await this.db.query('SELECT user_id FROM community_mentor_profiles WHERE user_id=$1 AND accepting=true',[mentorId]);
    if(!mentor) throw new NotFoundException('Mentor topilmadi');
    const [request]=await this.db.query(`INSERT INTO community_mentorship_requests(mentor_id,learner_id,message) VALUES($1,$2,$3) ON CONFLICT(mentor_id,learner_id) DO UPDATE SET message=EXCLUDED.message,status='pending',created_at=now() RETURNING id,status,created_at`,[mentorId,learnerId,message]);
    return request;
  }
  async mentorRequests(mentorId:string) {
    return this.db.query(`SELECT r.id,r.message,r.status,r.created_at,u.id AS learner_id,u.display_name,u.username,u."avatarUrl" AS avatar_url FROM community_mentorship_requests r JOIN users u ON u.id=r.learner_id WHERE r.mentor_id=$1 ORDER BY r.created_at DESC LIMIT 60`,[mentorId]);
  }
  async respondMentorRequest(mentorId:string,requestId:string,statusValue:unknown) {
    const status=statusValue==='accepted'?'accepted':statusValue==='declined'?'declined':null;
    if(!status) throw new BadRequestException('So‘rov holati noto‘g‘ri');
    const result=await this.db.query(`UPDATE community_mentorship_requests SET status=$1 WHERE id=$2 AND mentor_id=$3 AND status='pending' RETURNING id,status`,[status,requestId,mentorId]);
    if(!result.length) throw new NotFoundException('Kutilayotgan mentorlik so‘rovi topilmadi');
    return result[0];
  }
  async marathons(viewerId:string) {
    return this.db.query(`SELECT m.id,m.title,m.description,m.subject,m.duration_days,m.starts_at,u.display_name AS creator_name,u.username AS creator_username,(SELECT COUNT(*)::int FROM community_marathon_members mm WHERE mm.marathon_id=m.id) AS members_count,EXISTS(SELECT 1 FROM community_marathon_members mm WHERE mm.marathon_id=m.id AND mm.user_id=$1) AS joined,COALESCE((SELECT mm.progress FROM community_marathon_members mm WHERE mm.marathon_id=m.id AND mm.user_id=$1),0) AS progress FROM community_marathons m JOIN users u ON u.id=m.creator_id WHERE u.status='active' ORDER BY m.starts_at DESC LIMIT 60`,[viewerId]);
  }
  async createMarathon(creatorId:string,input:{title?:string;description?:string;subject?:string;durationDays?:number}) {
    const title=this.clean(input.title,140,'Marafon nomi'),description=this.clean(input.description,800,'Tavsif',false),subject=this.clean(input.subject,60,'Fan'),duration=Number(input.durationDays);
    if(!Number.isInteger(duration)||duration<1||duration>30) throw new BadRequestException('Marafon 1–30 kun bo‘lishi kerak');
    return this.db.transaction(async manager=>{
      const [m]=await manager.query('INSERT INTO community_marathons(creator_id,title,description,subject,duration_days) VALUES($1,$2,$3,$4,$5) RETURNING id,title,description,subject,duration_days,starts_at',[creatorId,title,description,subject,duration]);
      await manager.query('INSERT INTO community_marathon_members(marathon_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[m.id,creatorId]);
      return {...m,members_count:1,joined:true,progress:0};
    });
  }
  async joinMarathon(userId:string,marathonId:string) {
    const [m]=await this.db.query('SELECT id FROM community_marathons WHERE id=$1',[marathonId]);
    if(!m) throw new NotFoundException('Marafon topilmadi');
    await this.db.query('INSERT INTO community_marathon_members(marathon_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[marathonId,userId]);
    const [count]=await this.db.query('SELECT COUNT(*)::int AS members_count FROM community_marathon_members WHERE marathon_id=$1',[marathonId]);
    return {joined:true,membersCount:count.members_count};
  }
  async updateMarathonProgress(userId:string,marathonId:string,progressValue:unknown) {
    const progress=Number(progressValue);
    if(!Number.isInteger(progress)||progress<0||progress>100) throw new BadRequestException('Jarayon 0–100 oralig‘ida bo‘lishi kerak');
    const [member]=await this.db.query('UPDATE community_marathon_members SET progress=GREATEST(progress,$1) WHERE marathon_id=$2 AND user_id=$3 RETURNING progress',[progress,marathonId,userId]);
    if(!member) throw new BadRequestException('Avval marafonga qo‘shiling');
    return {progress:Number(member.progress),xpAwarded:0,zcAwarded:0};
  }

  async groupTasks(userId:string,groupId:string) {
    const [member]=await this.db.query('SELECT id FROM community_group_members WHERE group_id=$1 AND user_id=$2',[groupId,userId]);
    if(!member) throw new BadRequestException('Topshiriqlarni ko‘rish uchun guruh a’zosi bo‘ling');
    return this.db.query(`SELECT t.id,t.title,t.description,t.due_at,t.created_at,u.username AS creator_username,(SELECT COUNT(*)::int FROM community_group_task_completions c WHERE c.task_id=t.id) AS completed_count,EXISTS(SELECT 1 FROM community_group_task_completions c WHERE c.task_id=t.id AND c.user_id=$1) AS completed FROM community_group_tasks t JOIN users u ON u.id=t.creator_id WHERE t.group_id=$2 ORDER BY t.created_at DESC LIMIT 60`,[userId,groupId]);
  }
  async createGroupTask(userId:string,groupId:string,input:{title?:string;description?:string;dueAt?:string}) {
    const title=this.clean(input.title,140,'Topshiriq nomi'),description=this.clean(input.description,600,'Tavsif',false);
    const [owner]=await this.db.query(`SELECT id FROM community_group_members WHERE group_id=$1 AND user_id=$2 AND role='owner'`,[groupId,userId]);
    if(!owner) throw new BadRequestException('Topshiriqni faqat guruh egasi yaratadi');
    const dueAt=input.dueAt?new Date(input.dueAt):null;
    if(dueAt&&Number.isNaN(dueAt.getTime())) throw new BadRequestException('Muddat noto‘g‘ri');
    const [task]=await this.db.query('INSERT INTO community_group_tasks(group_id,creator_id,title,description,due_at) VALUES($1,$2,$3,$4,$5) RETURNING id,title,description,due_at,created_at',[groupId,userId,title,description,dueAt]);
    return {...task,completed_count:0,completed:false};
  }
  async completeGroupTask(userId:string,taskId:string) {
    const [task]=await this.db.query('SELECT group_id FROM community_group_tasks WHERE id=$1',[taskId]);
    if(!task) throw new NotFoundException('Topshiriq topilmadi');
    const [member]=await this.db.query('SELECT id FROM community_group_members WHERE group_id=$1 AND user_id=$2',[task.group_id,userId]);
    if(!member) throw new BadRequestException('Bu topshiriq faqat guruh a’zolari uchun');
    const [completion]=await this.db.query('INSERT INTO community_group_task_completions(task_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[taskId,userId]);
    if(completion) await this.db.query('UPDATE users SET xp=xp+2,level=GREATEST(1,FLOOR((xp+2)/100.0)::int+1) WHERE id=$1',[userId]);
    const [count]=await this.db.query('SELECT COUNT(*)::int AS completed_count FROM community_group_task_completions WHERE task_id=$1',[taskId]);
    return {completed:true,completedCount:count.completed_count,xpAwarded:completion?2:0};
  }

}
