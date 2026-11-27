import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';
import { API_BASE_URL, apiFetch, getToken } from './authService';

export interface CommunityPerson {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  profileFrame?: string | null;
  profileBadge?: string | null;
}

export interface CommunityPost {
  id: string;
  content: string;
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  subject?: string | null;
  author: CommunityPerson;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved?: boolean;
  isOwn: boolean;
}

export interface CommunityComment {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  replies?: CommunityComment[];
  repliesCount?: number;
  author: CommunityPerson;
}

export interface CommunityStory {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
  author: CommunityPerson;
  isOwn: boolean;
  viewed: boolean;
  viewsCount: number;
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('Kirish sessiyasi tugagan. Akkauntingizga qayta kiring.');
  if (response.status === 403) throw new Error('Bu amalni bajarish uchun ruxsat yo‘q.');
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Hamjamiyat serverida xatolik');
  return data as T;
}

export const getCommunityFeed = () => request<CommunityPost[]>('/api/community/posts?limit=40');
export const getCommunityClips = (limit = 40, offset = 0) => request<CommunityPost[]>(`/api/community/clips?limit=${Math.min(50, Math.max(1, limit))}&offset=${Math.max(0, offset)}`);
export const getCommunityClipPlayback = async (id: string) => {
  const playback = await request<{ url: string; mediaType: string }>(`/api/community/clips/${encodeURIComponent(id)}/playback`);
  return { ...playback, url: playback.url.startsWith('http') ? playback.url : `${API_BASE_URL}${playback.url}` };
};
export const createCommunityClip = (content: string, mediaKey: string, mediaType: string, subject?: string) =>
  request<CommunityPost>('/api/community/clips', 'POST', { content, mediaKey, mediaType, subject });
export const createCommunityPost = (content: string, mediaKey?: string, mediaType?: string) =>
  request<CommunityPost>('/api/community/posts', 'POST', { content, mediaKey, mediaType });
export const likeCommunityPost = (id: string) => request<{ isLiked: boolean; likesCount: number }>(`/api/community/posts/${encodeURIComponent(id)}/like`, 'POST');
export const unlikeCommunityPost = (id: string) => request<{ isLiked: boolean; likesCount: number }>(`/api/community/posts/${encodeURIComponent(id)}/unlike`, 'POST');
export const getCommunityComments = (id: string) => request<CommunityComment[]>(`/api/community/posts/${encodeURIComponent(id)}/comments`);
export const addCommunityComment = (id: string, content: string, parentId?: string) => request<CommunityComment>(`/api/community/posts/${encodeURIComponent(id)}/comments`, 'POST', { content, ...(parentId ? { parentId } : {}) });
export const saveCommunityClip = (id: string) => request<{ isSaved: boolean }>(`/api/community/clips/${encodeURIComponent(id)}/save`, 'POST');
export const unsaveCommunityClip = (id: string) => request<{ isSaved: boolean }>(`/api/community/clips/${encodeURIComponent(id)}/save`, 'DELETE');
export const getCommunityStories = () => request<CommunityStory[]>('/api/community/stories');
export const createCommunityStory = (mediaKey: string, mediaType: string, caption: string) =>
  request<CommunityStory>('/api/community/stories', 'POST', { mediaKey, mediaType, caption });
export const markCommunityStoryViewed = (id: string) =>
  request<{ viewed: boolean; viewsCount: number }>(`/api/community/stories/${encodeURIComponent(id)}/view`, 'POST');

function putBlobWithProgress(url: string, blob: Blob, headers: Record<string, string>, onProgress?: (percent: number) => void) {
  return new Promise<{ status: number; responseText: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(98, 3 + Math.round((event.loaded / event.total) * 95)));
    };
    xhr.onload = () => resolve({ status: xhr.status, responseText: xhr.responseText || '' });
    xhr.onerror = () => reject(new Error('Internet aloqasi uzildi. Yuklashni qayta urinib ko‘ring.'));
    xhr.ontimeout = () => reject(new Error('Yuklash vaqti tugadi. Internetni tekshirib, qayta urinib ko‘ring.'));
    xhr.onabort = () => reject(new Error('Yuklash bekor qilindi.'));
    xhr.send(blob);
  });
}

export async function uploadCommunityMedia(uri: string, contentType: string, onProgress?: (percent: number) => void, expectedSize?: number, sourceFile?: Blob) {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const key = await request<{ fileName: string; mediaType: string; mediaKey: string; uploadUrl: string }>('/api/community/media/upload-key', 'POST', { contentType });
  onProgress?.(1);
  const isVideo = contentType.startsWith('video/');
  const isDocument = contentType.startsWith('application/');
  const maxBytes = isVideo ? 30 * 1024 * 1024 : isDocument ? 15 * 1024 * 1024 : 8 * 1024 * 1024;
  const sizeError = isVideo ? 'Video hajmi 30 MB dan oshmasin' : isDocument ? 'Hujjat hajmi 15 MB dan oshmasin' : 'Rasm hajmi 8 MB dan oshmasin';
  const mediaHeaders = { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' };

  if (Platform.OS !== 'web') {
    // Native file:// and content:// URIs must be uploaded as the original file.
    // fetch(uri).blob() can silently produce truncated/empty blobs on Android.
    const file = new File(uri);
    if (!file.exists) throw new Error('Tanlangan fayl qurilmada topilmadi. Videoni qayta tanlang.');
    const fileSize = file.size;
    if (!fileSize) throw new Error('Video faylining asl hajmini aniqlab bo‘lmadi. Videoni galereyadan qayta tanlang.');
    if (fileSize > maxBytes) throw new Error(sizeError);
    if (expectedSize && fileSize !== expectedSize) throw new Error('Tanlangan video hajmi manba fayliga mos kelmadi. Videoni qayta tanlang.');
    onProgress?.(3);
    const verifyVideo = async (mediaKey: string): Promise<{ mediaKey: string; mediaType: string }> => {
      if (!isVideo) return { mediaKey, mediaType: key.mediaType };
      onProgress?.(99);
      const result = await request<{ verified: boolean; size: number; playbackMediaKey?: string; playbackMediaType?: string }>('/api/community/media/verify', 'POST', { mediaKey, contentType, expectedSize: fileSize });
      if (!result.verified || result.size !== fileSize || !result.playbackMediaKey || result.playbackMediaType !== 'video/mp4') throw new Error('Video serverda to‘liq saqlanmadi yoki ijro uchun moslashtirilmadi. Qayta yuklang.');
      return { mediaKey: result.playbackMediaKey, mediaType: result.playbackMediaType };
    };

    const uploadNative = async (url: string, headers: Record<string, string>) => file.upload(url, {
      httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers,
      onProgress: ({ bytesSent, totalBytes }) => {
        if (totalBytes > 0) onProgress?.(Math.min(98, 3 + Math.round((bytesSent / totalBytes) * 95)));
      },
    });

    let directStatus = 0;
    try {
      const direct = await uploadNative(key.uploadUrl, mediaHeaders);
      directStatus = direct.status;
    } catch {
      // Retry through the authenticated API proxy below; the original file is still streamed natively.
    }
    if (directStatus >= 200 && directStatus < 300) {
      const playable = await verifyVideo(key.mediaKey);
      onProgress?.(100);
      return playable;
    }

    const proxy = await uploadNative(
      `${API_BASE_URL}/api/community/media/upload/${encodeURIComponent(key.fileName)}`,
      { ...mediaHeaders, Authorization: `Bearer ${token}` },
    );
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(proxy.body || '{}') as Record<string, unknown>; } catch { /* handled below */ }
    if (proxy.status < 200 || proxy.status >= 300) {
      throw new Error(typeof data.message === 'string' ? data.message : 'Media faylni yuklab bo‘lmadi');
    }
    if (typeof data.mediaKey !== 'string' || typeof data.mediaType !== 'string') {
      throw new Error('Server yuklangan faylni tasdiqlamadi. Qayta urinib ko‘ring.');
    }
    const playable = await verifyVideo(data.mediaKey);
    onProgress?.(100);
    return playable;
  }

  // Web uses a Blob and the authenticated proxy (avoids cross-origin storage PUT issues).
  let blob = sourceFile;
  if (!blob) {
    const local = await fetch(uri);
    if (!local.ok) throw new Error('Tanlangan video faylini o‘qib bo‘lmadi');
    blob = await local.blob();
  }
  if (!blob.size || blob.size > maxBytes) throw new Error(sizeError);
  if (expectedSize && blob.size !== expectedSize) throw new Error('Video fayli to‘liq o‘qilmadi. Uni qayta tanlang.');
  onProgress?.(3);
  const proxy = await putBlobWithProgress(
    `${API_BASE_URL}/api/community/media/upload/${encodeURIComponent(key.fileName)}`,
    blob,
    { ...mediaHeaders, Authorization: `Bearer ${token}` },
    onProgress,
  );
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(proxy.responseText || '{}') as Record<string, unknown>; } catch { /* handled below */ }
  if (proxy.status < 200 || proxy.status >= 300) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Media faylni yuklab bo‘lmadi');
  }
  if (typeof data.mediaKey !== 'string' || typeof data.mediaType !== 'string') {
    throw new Error('Server yuklangan faylni tasdiqlamadi. Qayta urinib ko‘ring.');
  }
  let finalMediaKey = data.mediaKey;
  let finalMediaType = data.mediaType;
  if (isVideo) {
    onProgress?.(99);
    const result = await request<{ verified: boolean; size: number; playbackMediaKey?: string; playbackMediaType?: string }>('/api/community/media/verify', 'POST', { mediaKey: finalMediaKey, contentType, expectedSize: blob.size });
    if (!result.verified || result.size !== blob.size || !result.playbackMediaKey || result.playbackMediaType !== 'video/mp4') throw new Error('Video serverda to‘liq saqlanmadi yoki ijro uchun moslashtirilmadi. Qayta yuklang.');
    finalMediaKey = result.playbackMediaKey;
    finalMediaType = result.playbackMediaType;
  }
  onProgress?.(100);
  return { mediaKey: finalMediaKey, mediaType: finalMediaType };
}

export interface LearningGroup { id:string; name:string; description:string; subject:string; visibility:'public'|'private'; members_count:number; joined:boolean; is_owner:boolean; display_name:string; username:string; avatar_url:string|null; }
export interface LearningQuestion { id:string; subject:string; title:string; body:string; status:string; created_at:string; author_id:string; display_name:string; username:string; avatar_url:string|null; answers_count:number; best_answer_id:string|null; is_own:boolean; media_url:string|null; }
export interface LearningAnswer { id:string; body:string; is_best:boolean; author_id:string; display_name:string; username:string; }
export interface LearningResource { id:string; title:string; description:string; subject:string; file_type:string; created_at:string; author_id:string; display_name:string; username:string; saved:boolean; saves_count:number; average_rating:number; my_rating:number|null; ratings_count:number; }
const learningPath='/api/community/learning';
export const getLearningGroups=(subject?:string)=>request<LearningGroup[]>(`${learningPath}/groups${subject?`?subject=${encodeURIComponent(subject)}`:''}`);
export const createLearningGroup=(body:{name:string;description:string;subject:string;visibility:'public'|'private'})=>request<LearningGroup>(`${learningPath}/groups`,'POST',body);
export const joinLearningGroup=(id:string)=>request<{joined:boolean;membersCount:number}>(`${learningPath}/groups/${encodeURIComponent(id)}/join`,'POST');
export const getLearningQuestions=(subject?:string)=>request<LearningQuestion[]>(`${learningPath}/questions${subject?`?subject=${encodeURIComponent(subject)}`:''}`);
export const createLearningQuestion=(body:{subject:string;title:string;body:string;mediaKey?:string;mediaType?:string})=>request<LearningQuestion>(`${learningPath}/questions`,'POST',body);
export const getLearningAnswers=(id:string)=>request<LearningAnswer[]>(`${learningPath}/questions/${encodeURIComponent(id)}/answers`);
export const answerLearningQuestion=(id:string,body:string)=>request<LearningAnswer>(`${learningPath}/questions/${encodeURIComponent(id)}/answers`,'POST',{body});
export const acceptLearningAnswer=(id:string,answerId:string)=>request<{accepted:boolean;answerId:string}>(`${learningPath}/questions/${encodeURIComponent(id)}/answers/${encodeURIComponent(answerId)}/best`,'PATCH');
export const getLearningResources=(subject?:string)=>request<LearningResource[]>(`${learningPath}/library${subject?`?subject=${encodeURIComponent(subject)}`:''}`);
export const createLearningResource=(body:{title:string;description:string;subject:string;fileKey:string;fileType:string})=>request<LearningResource>(`${learningPath}/library`,'POST',body);
export const saveLearningResource=(id:string)=>request<{saved:boolean;savesCount:number}>(`${learningPath}/library/${encodeURIComponent(id)}/save`,'POST');
export const getLearningResourceDownload=(id:string)=>request<{url:string;fileType:string}>(`${learningPath}/library/${encodeURIComponent(id)}/download`);
export interface LearningGroupMessage { id:string; body:string; created_at:string; author_id:string; display_name:string; username:string; avatar_url:string|null; }
export const getLearningGroupMessages=(id:string)=>request<LearningGroupMessage[]>(`${learningPath}/groups/${encodeURIComponent(id)}/messages`);
export const sendLearningGroupMessage=(id:string,body:string)=>request<{id:string;body:string;created_at:string}>(`${learningPath}/groups/${encodeURIComponent(id)}/messages`,'POST',{body});

export const rateLearningResource=(id:string,rating:number)=>request<{myRating:number;averageRating:number;ratingsCount:number}>(`${learningPath}/library/${encodeURIComponent(id)}/rate`,'POST',{rating});
export interface LearningResourceComment { id:string; body:string; created_at:string; author_id:string; display_name:string; username:string; avatar_url:string|null; }
export const getLearningResourceComments=(id:string)=>request<LearningResourceComment[]>(`${learningPath}/library/${encodeURIComponent(id)}/comments`);
export const addLearningResourceComment=(id:string,body:string)=>request<LearningResourceComment>(`${learningPath}/library/${encodeURIComponent(id)}/comments`,'POST',{body});
export interface LearningPortfolioItem { id:string; kind:'project'|'certificate'|'skill'; title:string; description:string; link_url:string|null; created_at:string; author_id:string; display_name:string; username:string; avatar_url:string|null; is_own:boolean; }
export interface LearningMentor { user_id:string; display_name:string; username:string; avatar_url:string|null; xp:number; headline:string; subjects:string; bio:string; students_count:number; }
export interface LearningMarathon { id:string; title:string; description:string; subject:string; duration_days:number; starts_at:string; creator_name:string; creator_username:string; members_count:number; joined:boolean; progress:number; }
export const getLearningPortfolio=()=>request<LearningPortfolioItem[]>(`${learningPath}/portfolio`);
export const createLearningPortfolioItem=(body:{kind:'project'|'certificate'|'skill';title:string;description:string;linkUrl?:string})=>request<LearningPortfolioItem>(`${learningPath}/portfolio`,'POST',body);
export const getLearningMentors=()=>request<LearningMentor[]>(`${learningPath}/mentors`);
export const becomeLearningMentor=(body:{headline:string;subjects:string;bio:string})=>request<{enabled:boolean}>(`${learningPath}/mentors/profile`,'POST',body);
export const requestLearningMentor=(id:string,message:string)=>request<{id:string;status:string}>(`${learningPath}/mentors/${encodeURIComponent(id)}/request`,'POST',{message});
export const getLearningMarathons=()=>request<LearningMarathon[]>(`${learningPath}/marathons`);
export const createLearningMarathon=(body:{title:string;description:string;subject:string;durationDays:number})=>request<LearningMarathon>(`${learningPath}/marathons`,'POST',body);
export const joinLearningMarathon=(id:string)=>request<{joined:boolean;membersCount:number}>(`${learningPath}/marathons/${encodeURIComponent(id)}/join`,'POST');
export const updateLearningMarathonProgress=(id:string,progress:number)=>request<{progress:number;xpAwarded:number;zcAwarded:number}>(`${learningPath}/marathons/${encodeURIComponent(id)}/progress`,'PATCH',{progress});
export interface LearningMentorRequest { id:string; message:string; status:string; created_at:string; learner_id:string; display_name:string; username:string; avatar_url:string|null; }
export const getLearningMentorRequests=()=>request<LearningMentorRequest[]>(`${learningPath}/mentors/requests`);
export const respondLearningMentorRequest=(id:string,status:'accepted'|'declined')=>request<{id:string;status:string}>(`${learningPath}/mentors/requests/${encodeURIComponent(id)}`,'PATCH',{status});
export interface CommunityClipQuiz { id:string; question:string; options:string[]; attempted:boolean; selectedOption:number|null; isCorrect:boolean|null; isOwner?:boolean; canEdit?:boolean; correctOption?:number; }
export const getCommunityClipQuiz = async (id: string): Promise<CommunityClipQuiz | null> => {
  const raw = await request<unknown>(`/api/community/clips/${encodeURIComponent(id)}/quiz`);
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.options) || value.options.length !== 4 || value.options.some((option) => typeof option !== 'string' || !option.trim())) return null;
  if (typeof value.id !== 'string' || typeof value.question !== 'string' || !value.question.trim()) return null;
  const options = value.options as string[];
  const selected = value.selectedOption == null ? NaN : Number(value.selectedOption);
  const correct = value.correctOption == null ? NaN : Number(value.correctOption);
  return {
    id: value.id,
    question: value.question,
    options,
    attempted: value.attempted === true,
    selectedOption: Number.isInteger(selected) && selected >= 0 && selected < 4 ? selected : null,
    isCorrect: typeof value.isCorrect === 'boolean' ? value.isCorrect : null,
    isOwner: value.isOwner === true,
    canEdit: value.canEdit === true,
    ...(Number.isInteger(correct) && correct >= 0 && correct < 4 ? { correctOption: correct } : {}),
  };
};
export const createCommunityClipQuiz=(id:string,body:{question:string;options:string[];correctOption:number})=>request<{id:string;question:string;options:string[]}>(`/api/community/clips/${encodeURIComponent(id)}/quiz`,'POST',body);
export const answerCommunityClipQuiz=(id:string,selectedOption:number)=>request<{isCorrect:boolean;xpAwarded:number;zcAwarded:number}>(`/api/community/clips/${encodeURIComponent(id)}/quiz/answer`,'POST',{selectedOption});
export interface LearningGroupTask { id:string; title:string; description:string; due_at:string|null; creator_username:string; completed_count:number; completed:boolean; }
export const getLearningGroupTasks=(id:string)=>request<LearningGroupTask[]>(`${learningPath}/groups/${encodeURIComponent(id)}/tasks`);
export const createLearningGroupTask=(id:string,body:{title:string;description:string;dueAt?:string})=>request<LearningGroupTask>(`${learningPath}/groups/${encodeURIComponent(id)}/tasks`,'POST',body);
export const completeLearningGroupTask=(id:string)=>request<{completed:boolean;completedCount:number;xpAwarded:number}>(`${learningPath}/group-tasks/${encodeURIComponent(id)}/complete`,'POST');
