import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityStory } from './entities/community-story.entity';
import { CommunityStoryView } from './entities/community-story-view.entity';
import { CommunityStorageService } from './community-storage.service';
import { ZcWalletService } from './zc-wallet.service';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CommunityPost) private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityPostLike) private readonly likes: Repository<CommunityPostLike>,
    @InjectRepository(CommunityPostComment) private readonly comments: Repository<CommunityPostComment>,
    @InjectRepository(CommunityStory) private readonly stories: Repository<CommunityStory>,
    @InjectRepository(CommunityStoryView) private readonly storyViews: Repository<CommunityStoryView>,
    private readonly storage: CommunityStorageService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly wallet: ZcWalletService,
  ) {}

  private safePerson(user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      profileFrame: user.profileFrame,
      profileBadge: user.profileBadge,
    };
  }

  createUploadFileName(userId: string, contentType: string) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
    const extension = extensions[contentType];
    if (!extension) throw new BadRequestException('JPG, PNG, WEBP, PDF, Word, MP4, MOV yoki WEBM fayllar qabul qilinadi');
    const mediaKey = this.storage.createKey(userId, extension);
    return { fileName: mediaKey.split('/').pop(), mediaType: contentType, mediaKey, uploadUrl: this.storage.sign('PUT', mediaKey, 900) };
  }

  uploadMedia(userId: string, fileName: string, contentType: string, buffer: Buffer) {
    return this.storage.upload(userId, fileName, contentType, buffer);
  }

  verifyMedia(userId: string, mediaKey: string, contentType: string, expectedSize: number) {
    return this.storage.verify(userId, mediaKey, contentType, expectedSize);
  }

  private async mediaUrl(mediaKey?: string | null) {
    return mediaKey ? this.storage.sign('GET', mediaKey, 86400) : null;
  }

  async feed(viewerId: string, limit = 30) {
    const posts = await this.posts.find({
      where: { status: 'active' },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return Promise.all(posts.filter((post) => post.author?.status === 'active').map(async (post) => {
      const [likesCount, commentsCount, liked, mediaUrl] = await Promise.all([
        this.likes.count({ where: { postId: post.id } }),
        this.comments.count({ where: { postId: post.id } }),
        this.likes.exists({ where: { postId: post.id, userId: viewerId } }),
        this.mediaUrl(post.mediaKey),
      ]);
      return {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        mediaUrl,
        mediaType: post.mediaType,
        author: this.safePerson(post.author),
        likesCount,
        commentsCount,
        isLiked: liked,
        isOwn: post.authorId === viewerId,
      };
    }));
  }

  async createPost(authorId: string, rawContent: string, mediaKey?: string, mediaType?: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content && !mediaKey) throw new BadRequestException('Matn yoki media qo‘shing');
    if (content.length > 2000) throw new BadRequestException('Post 2000 belgidan oshmasin');
    if (mediaKey && (!mediaKey.startsWith(`community/${authorId}/`) || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'].includes(mediaType || ''))) {
      throw new BadRequestException('Media fayl noto‘g‘ri');
    }
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const post = await this.posts.save(this.posts.create({
      authorId, content, mediaKey: mediaKey || null, mediaType: mediaKey ? mediaType : null,
    }));
    return {
      id: post.id, content: post.content, createdAt: post.createdAt,
      mediaUrl: await this.mediaUrl(post.mediaKey), mediaType: post.mediaType,
      author: this.safePerson(author), likesCount: 0, commentsCount: 0, isLiked: false, isOwn: true,
    };
  }

  async clips(viewerId: string, limit = 30, offset = 0) {
    const posts = await this.posts.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.status = :status', { status: 'active' })
      .andWhere('author.status = :authorStatus', { authorStatus: 'active' })
      .andWhere('post.mediaType LIKE :videoType', { videoType: 'video/%' })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .skip(Math.min(Math.max(Math.floor(offset), 0), 10000))
      .take(Math.min(Math.max(Math.floor(limit), 1), 50))
      .getMany();
    return Promise.all(posts.map(async (post) => {
      const [likesCount, commentsCount, liked, mediaUrl] = await Promise.all([
        this.likes.count({ where: { postId: post.id } }),
        this.comments.count({ where: { postId: post.id } }),
        this.likes.exists({ where: { postId: post.id, userId: viewerId } }),
        this.mediaUrl(post.mediaKey),
      ]);
      return {
        id: post.id, content: post.content, createdAt: post.createdAt, mediaUrl, mediaType: post.mediaType, subject: post.subject,
        author: this.safePerson(post.author), likesCount, commentsCount, isLiked: liked, isOwn: post.authorId === viewerId,
      };
    }));
  }

  async createClip(authorId: string, rawContent: string, mediaKey: string, mediaType: string, rawSubject?: string) {
    if (!mediaKey?.startsWith(`community/${authorId}/`) || !['video/mp4', 'video/quicktime', 'video/webm'].includes(mediaType)) {
      throw new BadRequestException('Faqat MP4, MOV yoki WEBM videolar qabul qilinadi');
    }
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (content.length > 2000) throw new BadRequestException('Video izohi 2000 belgidan oshmasin');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const subject = typeof rawSubject === 'string' ? rawSubject.trim().slice(0,60) : '';
    const post = await this.posts.save(this.posts.create({ authorId, content, mediaKey, mediaType, subject: subject || null }));
    return {
      id: post.id, content, createdAt: post.createdAt, mediaUrl: await this.mediaUrl(mediaKey), mediaType, subject: post.subject,
      author: this.safePerson(author), likesCount: 0, commentsCount: 0, isLiked: false, isOwn: true,
    };
  }

  async createStory(authorId: string, mediaKey: string, mediaType: string, rawCaption?: string) {
    const caption = typeof rawCaption === 'string' ? rawCaption.trim() : '';
    if (!mediaKey?.startsWith(`community/${authorId}/`) || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
      throw new BadRequestException('Story rasmi noto‘g‘ri');
    }
    if (caption.length > 300) throw new BadRequestException('Story matni 300 belgidan oshmasin');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const createdAt = new Date();
    const story = await this.stories.save(this.stories.create({
      authorId, mediaKey, mediaType, caption,
      expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    }));
    return {
      id: story.id, mediaUrl: await this.mediaUrl(story.mediaKey), mediaType,
      caption, createdAt, expiresAt: story.expiresAt, author: this.safePerson(author),
      isOwn: true, viewed: true, viewsCount: 0,
    };
  }

  async listStories(viewerId: string) {
    const stories = await this.stories.find({
      where: { expiresAt: require('typeorm').MoreThan(new Date()) },
      relations: { author: true },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    return Promise.all(stories.filter((story) => story.author?.status === 'active').map(async (story) => {
      const [viewed, viewsCount, mediaUrl] = await Promise.all([
        this.storyViews.exists({ where: { storyId: story.id, viewerId } }),
        this.storyViews.count({ where: { storyId: story.id } }),
        this.mediaUrl(story.mediaKey),
      ]);
      return {
        id: story.id, mediaUrl, mediaType: story.mediaType, caption: story.caption,
        createdAt: story.createdAt, expiresAt: story.expiresAt,
        author: this.safePerson(story.author), isOwn: story.authorId === viewerId,
        viewed: story.authorId === viewerId || viewed, viewsCount,
      };
    }));
  }

  async markStoryViewed(viewerId: string, storyId: string) {
    const story = await this.stories.findOne({
      where: { id: storyId, expiresAt: require('typeorm').MoreThan(new Date()) },
    });
    if (!story) throw new NotFoundException('Story topilmadi yoki muddati tugagan');
    if (story.authorId !== viewerId) {
      await this.storyViews.createQueryBuilder().insert()
        .values({ storyId, viewerId }).orIgnore().execute();
    }
    return { viewed: true, viewsCount: await this.storyViews.count({ where: { storyId } }) };
  }

  async toggleLike(userId: string, postId: string, liked: boolean) {
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    if (liked) {
      await this.likes.createQueryBuilder().insert().values({ postId, userId }).orIgnore().execute();
    } else {
      await this.likes.delete({ postId, userId });
    }
    return { isLiked: liked, likesCount: await this.likes.count({ where: { postId } }) };
  }

  async listComments(postId: string) {
    const postExists = await this.posts.exists({ where: { id: postId, status: 'active' } });
    if (!postExists) throw new NotFoundException('Post topilmadi');
    const comments = await this.comments.find({
      where: { postId }, relations: { author: true }, order: { createdAt: 'ASC' }, take: 100,
    });
    return comments.filter((item) => item.author?.status === 'active').map((item) => ({
      id: item.id, content: item.content, createdAt: item.createdAt, author: this.safePerson(item.author),
    }));
  }

  async addComment(authorId: string, postId: string, rawContent: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new BadRequestException('Izoh matnini kiriting');
    if (content.length > 1000) throw new BadRequestException('Izoh 1000 belgidan oshmasin');
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const comment = await this.comments.save(this.comments.create({ postId, authorId, content }));
    return { id: comment.id, content: comment.content, createdAt: comment.createdAt, author: this.safePerson(author) };
  }

  async getClipQuiz(viewerId:string,postId:string) {
    const [quiz]=await this.dataSource.query(`SELECT q.id,q.author_id,q.correct_option,q.question,q.option_a,q.option_b,q.option_c,q.option_d FROM community_clip_quizzes q JOIN community_posts p ON p.id=q.post_id WHERE q.post_id=$1 AND p.status='active' AND p."mediaType" LIKE 'video/%'`,[postId]);
    if(!quiz) return null;
    const [attempt]=await this.dataSource.query('SELECT selected_option,is_correct FROM community_clip_quiz_attempts WHERE quiz_id=$1 AND user_id=$2',[quiz.id,viewerId]);
    const [count]=await this.dataSource.query('SELECT COUNT(*)::int AS attempts_count FROM community_clip_quiz_attempts WHERE quiz_id=$1',[quiz.id]);
    const isOwner=quiz.author_id===viewerId;
    return {id:quiz.id,question:quiz.question,options:[quiz.option_a,quiz.option_b,quiz.option_c,quiz.option_d],attempted:Boolean(attempt),selectedOption:attempt?Number(attempt.selected_option):null,isCorrect:attempt?Boolean(attempt.is_correct):null,isOwner,canEdit:isOwner&&Number(count.attempts_count)===0,correctOption:isOwner?Number(quiz.correct_option):undefined};
  }

  async createClipQuiz(authorId:string,postId:string,input:{question?:string;options?:string[];correctOption?:number}) {
    const question=typeof input.question==='string'?input.question.trim():'';
    const options=Array.isArray(input.options)?input.options.map(value=>typeof value==='string'?value.trim():''):[];
    const correct=Number(input.correctOption);
    if(!question||question.length>400||options.length!==4||options.some(value=>!value||value.length>240)||!Number.isInteger(correct)||correct<0||correct>3) throw new BadRequestException('Savol va 4 ta javob variantini to‘liq kiriting');
    return this.dataSource.transaction(async manager=>{
      const [post]=await manager.query(`SELECT id FROM community_posts WHERE id=$1 AND "authorId"=$2 AND status='active' AND "mediaType" LIKE 'video/%' FOR UPDATE`,[postId,authorId]);
      if(!post) throw new NotFoundException('Video topilmadi yoki sizga tegishli emas');
      const [existing]=await manager.query('SELECT id FROM community_clip_quizzes WHERE post_id=$1 FOR UPDATE',[postId]);
      let quiz:any;
      if(existing){
        const [attempts]=await manager.query('SELECT COUNT(*)::int AS total FROM community_clip_quiz_attempts WHERE quiz_id=$1',[existing.id]);
        if(Number(attempts.total)>0) throw new BadRequestException('Birinchi javob yuborilgach mini-testni o‘zgartirib bo‘lmaydi');
        [quiz]=await manager.query('UPDATE community_clip_quizzes SET question=$1,option_a=$2,option_b=$3,option_c=$4,option_d=$5,correct_option=$6 WHERE id=$7 RETURNING id,question,option_a,option_b,option_c,option_d',[question,...options,correct,existing.id]);
      } else {
        [quiz]=await manager.query('INSERT INTO community_clip_quizzes(post_id,author_id,question,option_a,option_b,option_c,option_d,correct_option) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,question,option_a,option_b,option_c,option_d',[postId,authorId,question,...options,correct]);
      }
      return {id:quiz.id,question:quiz.question,options:[quiz.option_a,quiz.option_b,quiz.option_c,quiz.option_d]};
    });
  }

  async answerClipQuiz(userId:string,postId:string,selectedValue:unknown) {
    const selected=Number(selectedValue);
    if(!Number.isInteger(selected)||selected<0||selected>3) throw new BadRequestException('Javob variantini tanlang');
    const result=await this.dataSource.transaction(async manager=>{
      const [quiz]=await manager.query('SELECT id,author_id,correct_option FROM community_clip_quizzes WHERE post_id=$1 FOR UPDATE',[postId]);
      if(!quiz) throw new NotFoundException('Bu videoda mini-test yo‘q');
      if(quiz.author_id===userId) throw new BadRequestException('O‘zingiz yaratgan mini-testni yecha olmaysiz');
      const isCorrect=Number(quiz.correct_option)===selected;
      const [attempt]=await manager.query('INSERT INTO community_clip_quiz_attempts(quiz_id,user_id,selected_option,is_correct) VALUES($1,$2,$3,$4) ON CONFLICT(quiz_id,user_id) DO NOTHING RETURNING id',[quiz.id,userId,selected,isCorrect]);
      if(!attempt){
        const [previous]=await manager.query('SELECT is_correct FROM community_clip_quiz_attempts WHERE quiz_id=$1 AND user_id=$2',[quiz.id,userId]);
        if(!previous) throw new BadRequestException('Bu mini-testga javob qabul qilinmadi');
        return {quizId:quiz.id,isCorrect:Boolean(previous.is_correct),awarded:Boolean(previous.is_correct),newAttempt:false};
      }
      if(isCorrect) await manager.query('UPDATE users SET xp=xp+5,level=GREATEST(1,FLOOR((xp+5)/100.0)::int+1) WHERE id=$1',[userId]);
      return {quizId:quiz.id,isCorrect,awarded:isCorrect,newAttempt:true};
    });
    if(result.awarded) await this.wallet.credit(userId,2,'Lavha mini-testini to‘g‘ri yechish',`community-clip-quiz:${result.quizId}:${userId}`);
    return {isCorrect:result.isCorrect,xpAwarded:result.newAttempt&&result.awarded?5:0,zcAwarded:result.awarded?2:0};
  }
}
