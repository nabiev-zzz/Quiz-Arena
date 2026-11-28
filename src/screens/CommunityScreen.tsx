import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CommunityReelsFeed from '../components/CommunityReelsFeed';
import CommunityClipVideo from '../components/CommunityClipVideo';
import CommunityLearningHubScreen from './CommunityLearningHubScreen';
import CommunityDashboardScreen, { CommunityBottomNavigation, CommunityCompetitionsScreen, type CommunitySectionKey } from './CommunityDashboardScreen';
import * as ImagePicker from 'expo-image-picker';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import { communityTokens, type CommunityColors } from '../theme/communityTokens';
import Snowfall from '../components/Snowfall';
import {
  addCommunityComment, createCommunityPost, createCommunityStory, getCommunityComments,
  getCommunityFeed, getCommunityStories, getCommunityClips, createCommunityClip, likeCommunityPost, markCommunityStoryViewed,
  unlikeCommunityPost, uploadCommunityMedia, updateCommunityPost, deleteCommunityPost, deleteCommunityStory, getCommunityClipQuiz, createCommunityClipQuiz, answerCommunityClipQuiz, saveCommunityClip, unsaveCommunityClip,
  type CommunityComment, type CommunityPost, type CommunityStory, type CommunityClipQuiz,
} from '../services/communityService';

interface Props {
  onBack: () => void;
  onDiscoverUsers: () => void;
  onMessages: () => void;
  onChallenges: () => void;
  onDailyTasks: () => void;
  onTutor: () => void;
  onUserPress: (username: string) => void;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'Z';
}
function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Hozirgina';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daqiqa oldin`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`;
  return new Date(value).toLocaleDateString();
}
function imageMime(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType === 'image/png') return 'image/png';
  if (asset.mimeType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export default function CommunityScreen({ onBack, onDiscoverUsers, onMessages, onDailyTasks, onTutor, onUserPress }: Props) {
  const { mode, isDark } = useTheme();
  const c = communityTokens[mode].colors;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [clips, setClips] = useState<CommunityPost[]>([]);
  const [clipsHasMore, setClipsHasMore] = useState(false);
  const [clipsLoadingMore, setClipsLoadingMore] = useState(false);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [clipsError, setClipsError] = useState(false);
  const [clipsLoaded, setClipsLoaded] = useState(false);
  const [clipsServerOffset, setClipsServerOffset] = useState(0);
  const clipsLoadingMoreRef = useRef(false);
  const clipsLoadingRef = useRef(false);
  const commentSheetStartY = useRef(0);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'feed' | 'clips' | 'groups' | 'questions' | 'library' | 'portfolio' | 'mentors' | 'marathons' | 'competitions'>('dashboard');
  const [clipBusy, setClipBusy] = useState(false);
  const [clipComposerVisible, setClipComposerVisible] = useState(false);
  const [clipSubject, setClipSubject] = useState('Boshqa');
  const [selectedClip, setSelectedClip] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [clipUploadProgress, setClipUploadProgress] = useState<number | null>(null);
  const [clipUploadStage, setClipUploadStage] = useState('');
  const [clipUploadError, setClipUploadError] = useState('');
  const [clipCaption, setClipCaption] = useState('');
  const [stories, setStories] = useState<CommunityStory[]>([]);
  const [content, setContent] = useState('');
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [busySave, setBusySave] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentsLoadingId, setCommentsLoadingId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [storyBusy, setStoryBusy] = useState(false);
  const [selectedStory, setSelectedStory] = useState<CommunityStory | null>(null);
  const [quizClip, setQuizClip] = useState<CommunityPost | null>(null);
  const [clipQuiz, setClipQuiz] = useState<CommunityClipQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptions, setQuizOptions] = useState(['','','','']);
  const [correctOption, setCorrectOption] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);


  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setFeedError(false);
    try {
      const [feed, activeStories] = await Promise.all([getCommunityFeed(), getCommunityStories()]);
      setPosts(feed);
      setStories(activeStories);
    } catch {
      setFeedError(true);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Load the Reels feed only when the user opens it. The home/community screen
  // should not wait for dozens of video records before becoming interactive.
  const loadClips = useCallback(async (quiet = false) => {
    if (clipsLoadingRef.current) return;
    clipsLoadingRef.current = true;
    if (!quiet) setClipsLoading(true);
    setClipsError(false);
    try {
      const firstPage = await getCommunityClips(8, 0);
      setClips(firstPage);
      setClipsServerOffset(firstPage.length);
      setClipsHasMore(firstPage.length === 8);
      setClipsLoaded(true);
    } catch {
      setClipsError(true);
    } finally {
      clipsLoadingRef.current = false;
      setClipsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial async fetch; state updates occur after the network request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (activeSection === 'clips' && !clipsLoaded && !clipsLoadingRef.current) void loadClips();
  }, [activeSection, clipsLoaded, loadClips]);

  const loadMoreClips = useCallback(async () => {
    if (clipsLoadingMoreRef.current || !clipsHasMore) return;
    clipsLoadingMoreRef.current = true;
    setClipsLoadingMore(true);
    try {
      const next = await getCommunityClips(8, clipsServerOffset);
      setClips((current) => {
        const known = new Set(current.map((clip) => clip.id));
        const uniqueNext: CommunityPost[] = [];
        for (const clip of next) {
          if (known.has(clip.id)) continue;
          known.add(clip.id);
          uniqueNext.push(clip);
        }
        return [...current, ...uniqueNext];
      });
      setClipsServerOffset((current) => current + next.length);
      setClipsHasMore(next.length === 8);
    } catch (error) {
      showLocalizedAlert('Lavhalar', error instanceof Error ? error.message : 'Keyingi videolar yuklanmadi');
    } finally { clipsLoadingMoreRef.current = false; setClipsLoadingMore(false); }
  }, [clipsHasMore, clipsServerOffset]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showLocalizedAlert('Ruxsat kerak', 'Rasm tanlash uchun galereyaga ruxsat bering.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.78,
    });
    return result.canceled ? null : result.assets[0] ?? null;
  };

  const publish = async () => {
    const text = content.trim();
    if ((!text && !selectedImage) || posting) return;
    setPosting(true);
    try {
      let media: { mediaKey: string; mediaType: string } | undefined;
      if (selectedImage) media = await uploadCommunityMedia(selectedImage.uri, imageMime(selectedImage));
      const created = await createCommunityPost(text, media?.mediaKey, media?.mediaType);
      setPosts((current) => [created, ...current]);
      setContent('');
      setSelectedImage(null);
    } catch (error) {
      showLocalizedAlert('Post joylanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
    } finally { setPosting(false); }
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showLocalizedAlert('Ruxsat kerak', 'Video tanlash uchun galereyaga ruxsat bering.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'], allowsEditing: false, videoMaxDuration: 90,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if (asset.duration && asset.duration > 90_000) {
      showLocalizedAlert('Video uzun', 'Video 90 soniyadan oshmasin.');
      return null;
    }
    if (asset.fileSize && asset.fileSize > 30 * 1024 * 1024) {
      showLocalizedAlert('Video hajmi katta', 'Tezroq yuklanishi uchun video 30 MB dan oshmasin.');
      return null;
    }
    return asset;
  };

  const videoMime = (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.file?.type === 'video/quicktime' || asset.file?.type === 'video/webm' || asset.file?.type === 'video/mp4') return asset.file.type;
    if (asset.mimeType === 'video/quicktime' || asset.mimeType === 'video/webm' || asset.mimeType === 'video/mp4') return asset.mimeType;
    const fileName = (asset.fileName || asset.uri).toLowerCase().split('?')[0];
    if (fileName.endsWith('.mov')) return 'video/quicktime';
    if (fileName.endsWith('.webm')) return 'video/webm';
    if (fileName.endsWith('.mp4')) return 'video/mp4';
    throw new Error('Faqat MP4, MOV yoki WEBM video formatlari qabul qilinadi.');
  };

  const chooseClip = async () => {
    if (clipBusy) return;
    try {
      const asset = await pickVideo();
      if (asset) { setSelectedClip(asset); setClipUploadProgress(null); setClipUploadStage(''); setClipUploadError(''); setClipComposerVisible(true); }
    } catch (error) {
      showLocalizedAlert('Video tanlash', error instanceof Error ? error.message : 'Video tanlanmadi');
    }
  };

  const publishClip = async () => {
    if (clipBusy) return;
    try {
      if (!selectedClip) {
        showLocalizedAlert('Avval video tanlang', 'Galereyadan videoni tanlang, keyin Yuklash tugmasini bosing.');
        return;
      }
      setClipBusy(true);
      setClipUploadError('');
      setClipUploadProgress(0);
      setClipUploadStage('Yuklashga tayyorlanmoqda...');
      const media = await uploadCommunityMedia(
        selectedClip.uri,
        videoMime(selectedClip),
        (percent) => {
          setClipUploadProgress(percent);
          if (percent >= 99) setClipUploadStage('Video ijro uchun moslashtirilmoqda...');
          else if (percent >= 3) setClipUploadStage('Video serverga yuborilmoqda...');
          else setClipUploadStage('Server bilan aloqa o‘rnatilmoqda...');
        },
        selectedClip.fileSize,
        selectedClip.file,
      );
      setClipUploadStage('Video joylanmoqda...');
      setClipUploadProgress(100);
      const created = await createCommunityClip(clipCaption.trim(), media.mediaKey, media.mediaType, clipSubject);
      setClips((current) => [created, ...current]);
      setClipsLoaded(true);
      setPosts((current) => [created, ...current]);
      setClipCaption('');
      setClipSubject('Boshqa');
      setSelectedClip(null);
      setClipUploadProgress(null);
      setClipUploadStage('');
      setClipUploadError('');
      setClipComposerVisible(false);
      setActiveSection('clips');
      showLocalizedAlert('Tayyor!', 'Video lavha muvaffaqiyatli joylandi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Qayta urinib ko‘ring';
      setClipUploadError(message);
      setClipUploadStage('Yuklash yakunlanmadi');
    } finally { setClipBusy(false); }
  };

  const openClipQuiz = async (clip: CommunityPost) => {
    setQuizClip(clip); setClipQuiz(null); setQuizQuestion(''); setQuizOptions(['','','','']); setCorrectOption(0); setSelectedOption(null); setQuizLoading(true);
    try { const quiz=await getCommunityClipQuiz(clip.id); setClipQuiz(quiz); if(quiz?.isOwner&&quiz.canEdit){setQuizQuestion(quiz.question);setQuizOptions(quiz.options);setCorrectOption(quiz.correctOption??0)} }
    catch (error) { showLocalizedAlert('Mini-test', error instanceof Error ? error.message : 'Mini-test yuklanmadi'); }
    finally { setQuizLoading(false); }
  };
  const publishClipQuiz = async () => {
    if (!quizClip || quizBusy) return;
    setQuizBusy(true);
    try {
      const result = await createCommunityClipQuiz(quizClip.id, { question: quizQuestion, options: quizOptions, correctOption });
      setClipQuiz({ ...result, attempted: false, selectedOption: null, isCorrect: null, isOwner: true, canEdit: true, correctOption });
      showLocalizedAlert('Mini-test tayyor', 'Videongizga mini-test biriktirildi.');
    } catch (error) { showLocalizedAlert('Mini-test', error instanceof Error ? error.message : 'Saqlanmadi'); }
    finally { setQuizBusy(false); }
  };
  const submitClipQuiz = async () => {
    if (!quizClip || selectedOption === null || quizBusy) return;
    setQuizBusy(true);
    try {
      const result = await answerCommunityClipQuiz(quizClip.id, selectedOption);
      setClipQuiz(current => current ? { ...current, attempted: true, selectedOption, isCorrect: result.isCorrect } : current);
      showLocalizedAlert(result.isCorrect ? 'To‘g‘ri javob!' : 'Keyingi safar omad!', result.isCorrect ? `${result.xpAwarded} XP va ${result.zcAwarded} ZC oldingiz.` : 'Bu safar javob noto‘g‘ri.');
    } catch (error) { showLocalizedAlert('Mini-test', error instanceof Error ? error.message : 'Javob qabul qilinmadi'); }
    finally { setQuizBusy(false); }
  };

  const publishStory = async () => {
    if (storyBusy) return;
    try {
      const asset = await pickImage();
      if (!asset) return;
      setStoryBusy(true);
      const media = await uploadCommunityMedia(asset.uri, imageMime(asset));
      const created = await createCommunityStory(media.mediaKey, media.mediaType, '');
      setStories((current) => [...current, created]);
      setSelectedStory(created);
    } catch (error) {
      showLocalizedAlert('Story joylanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
    } finally { setStoryBusy(false); }
  };

  const openStory = async (story: CommunityStory) => {
    setSelectedStory(story);
    if (story.viewed) return;
    try {
      const result = await markCommunityStoryViewed(story.id);
      setStories((current) => current.map((item) => item.id === story.id ? { ...item, viewed: true, viewsCount: result.viewsCount } : item));
      setSelectedStory((current) => current?.id === story.id ? { ...current, viewed: true, viewsCount: result.viewsCount } : current);
    } catch (error) {
      showLocalizedAlert('Story', error instanceof Error ? error.message : 'Story ko‘rish qayd etilmadi');
    }
  };

  const openPostActions = (post: CommunityPost) => {
    if (!post.isOwn) return;
    Alert.alert('Postni boshqarish', 'O‘zingiz joylagan post uchun amalni tanlang.', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Tahrirlash', onPress: () => { setEditingPost(post); setEditContent(post.content); } },
      { text: 'O‘chirish', style: 'destructive', onPress: () => Alert.alert('Post o‘chirilsinmi?', 'Post lentadan va profilingizdan olib tashlanadi.', [
        { text: 'Yo‘q', style: 'cancel' },
        { text: 'Ha, o‘chirish', style: 'destructive', onPress: () => { void (async () => {
          try {
            await deleteCommunityPost(post.id);
            setPosts((items) => items.filter((item) => item.id !== post.id));
            setClips((items) => items.filter((item) => item.id !== post.id));
          } catch (error) { showLocalizedAlert('O‘chirilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
        })(); } },
      ]) },
    ]);
  };

  const savePostEdit = async () => {
    if (!editingPost || savingPostEdit) return;
    setSavingPostEdit(true);
    try {
      const result = await updateCommunityPost(editingPost.id, editContent);
      const update = (items: CommunityPost[]) => items.map((item) => item.id === result.id ? { ...item, content: result.content } : item);
      setPosts(update); setClips(update); setEditingPost(null);
    } catch (error) { showLocalizedAlert('Tahrirlanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
    finally { setSavingPostEdit(false); }
  };

  const deleteOwnStory = (story: CommunityStory) => Alert.alert('Story o‘chirilsinmi?', 'Bu story boshqa foydalanuvchilarga ko‘rinmaydi.', [
    { text: 'Bekor qilish', style: 'cancel' },
    { text: 'O‘chirish', style: 'destructive', onPress: () => { void (async () => {
      try { await deleteCommunityStory(story.id); setStories((items) => items.filter((item) => item.id !== story.id)); setSelectedStory(null); }
      catch (error) { showLocalizedAlert('Story o‘chirilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
    })(); } },
  ]);

  const toggleLike = async (post: CommunityPost) => {
    if (busyPost) return;
    setBusyPost(post.id);
    const nextLiked = !post.isLiked;
    const optimistic = (items: CommunityPost[]) => items.map((item) => item.id === post.id
      ? { ...item, isLiked: nextLiked, likesCount: Math.max(0, item.likesCount + (nextLiked ? 1 : -1)) } : item);
    setPosts(optimistic);
    setClips(optimistic);
    try {
      const result = nextLiked ? await likeCommunityPost(post.id) : await unlikeCommunityPost(post.id);
      const applyResult = (items: CommunityPost[]) => items.map((item) => item.id === post.id ? { ...item, ...result } : item);
      setPosts(applyResult);
      setClips(applyResult);
    } catch (error) {
      const rollback = (items: CommunityPost[]) => items.map((item) => item.id === post.id
        ? { ...item, isLiked: post.isLiked, likesCount: post.likesCount } : item);
      setPosts(rollback);
      setClips(rollback);
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Layk qo‘yilmadi');
    } finally { setBusyPost(null); }
  };

  const toggleSaveClip = async (clip: CommunityPost) => {
    if (busySave) return;
    setBusySave(clip.id);
    const nextSaved = !clip.isSaved;
    const update = (items: CommunityPost[]) => items.map((item) => item.id === clip.id ? { ...item, isSaved: nextSaved } : item);
    setClips(update);
    setPosts(update);
    try {
      if (nextSaved) await saveCommunityClip(clip.id);
      else await unsaveCommunityClip(clip.id);
    } catch (error) {
      const rollback = (items: CommunityPost[]) => items.map((item) => item.id === clip.id ? { ...item, isSaved: clip.isSaved } : item);
      setClips(rollback);
      setPosts(rollback);
      showLocalizedAlert('Saqlash', error instanceof Error ? error.message : 'Lavha saqlanmadi');
    } finally { setBusySave(null); }
  };

  const openComments = async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    try {
      const loaded = await getCommunityComments(postId);
      setComments((current) => ({ ...current, [postId]: loaded }));
    } catch (error) { showLocalizedAlert('Izohlar', error instanceof Error ? error.message : 'Izohlar yuklanmadi'); }
  };

  const openClipComments = async (postId: string) => {
    setExpandedPost(postId);
    setReplyingTo(null);
    setCommentsLoadingId(postId);
    try {
      const loaded = await getCommunityComments(postId);
      setComments((current) => ({ ...current, [postId]: loaded }));
    } catch (error) {
      showLocalizedAlert('Izohlar', error instanceof Error ? error.message : 'Izohlar yuklanmadi');
    } finally { setCommentsLoadingId((current) => current === postId ? null : current); }
  };

  const sendComment = async (postId: string, parentId?: string) => {
    const text = commentDraft.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const comment = await addCommunityComment(postId, text, parentId);
      setComments((current) => ({
        ...current,
        [postId]: parentId
          ? (current[postId] || []).map((item) => item.id === parentId ? { ...item, replies: [...(item.replies || []), comment], repliesCount: (item.repliesCount || 0) + 1 } : item)
          : [...(current[postId] || []), comment],
      }));
      const increment = (items: CommunityPost[]) => items.map((item) => item.id === postId ? { ...item, commentsCount: item.commentsCount + 1 } : item);
      setPosts(increment);
      setClips(increment);
      setCommentDraft('');
      setReplyingTo(null);
      if (parentId) setExpandedReplies((current) => ({ ...current, [parentId]: true }));
    } catch (error) { showLocalizedAlert('Izoh yuborilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
    finally { setSendingComment(false); }
  };

  const styles = makeStyles(c, isDark);
  const renderPerson = (person: CommunityPost['author']) => (
    <Pressable style={styles.person} onPress={() => onUserPress(person.username)}>
      {person.avatarUrl
        ? <Image source={{ uri: person.avatarUrl }} style={styles.avatar} />
        : <View style={styles.avatarFallback}><LocalizedText style={styles.avatarInitial}>{initials(person.displayName)}</LocalizedText></View>}
      <View style={{ flex: 1 }}>
        <LocalizedText style={styles.name} numberOfLines={1}>{person.displayName}</LocalizedText>
        <LocalizedText style={styles.handle}>@{person.username}</LocalizedText>
      </View>
    </Pressable>
  );

  if (activeSection === 'dashboard') {
    return <CommunityDashboardScreen
      onBack={onBack}
      onDailyTasks={onDailyTasks}
      onTutor={onTutor}
      onDiscoverUsers={onDiscoverUsers}
      onNavigate={(section: CommunitySectionKey) => {
        if (section === 'messages') { onMessages(); return; }
        setActiveSection(section);
      }}
    />;
  }
  if (activeSection === 'competitions') {
    return <CommunityCompetitionsScreen onBack={() => setActiveSection('dashboard')} />;
  }
  if (['groups', 'questions', 'library', 'portfolio', 'mentors', 'marathons'].includes(activeSection)) {
    return <CommunityLearningHubScreen initialSection={activeSection as 'groups' | 'questions' | 'library' | 'portfolio' | 'mentors' | 'marathons'} onBack={() => setActiveSection('dashboard')} onNavigate={section => { if (section === 'home') setActiveSection('dashboard'); else if (section === 'messages') onMessages(); else setActiveSection(section); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: activeSection === 'clips' ? '#05060A' : c.background }}>
      {activeSection !== 'feed' && activeSection !== 'clips' ? <Snowfall /> : null}
      {activeSection === 'clips' ? (
        <CommunityReelsFeed clips={clips} loading={clipsLoading} error={clipsError}
          onBack={() => setActiveSection('dashboard')} onUpload={() => void chooseClip()}
          onRetry={() => void loadClips()} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadClips(true); }}
          hasMore={clipsHasMore} loadingMore={clipsLoadingMore} onLoadMore={() => void loadMoreClips()}
          onLike={(clip) => void toggleLike(clip)} onSave={(clip) => void toggleSaveClip(clip)} onComments={(id) => void openClipComments(id)} overlayOpen={Boolean(expandedPost || quizClip || clipComposerVisible)}
          onMiniTest={(clip) => void openClipQuiz(clip)} onUserPress={onUserPress} onDeleteOwnClip={(clip) => { void (async () => { try { await deleteCommunityPost(clip.id); setClips((items) => items.filter((item) => item.id !== clip.id)); setPosts((items) => items.filter((item) => item.id !== clip.id)); } catch (error) { showLocalizedAlert('Lavha o‘chirilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); } })(); }} />
      ) : <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={c.primary} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => setActiveSection('dashboard')} style={styles.iconButton}><Ionicons name="arrow-back" size={21} color={c.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.eyebrow}>ZELQEN SOCIAL</LocalizedText>
            <LocalizedText style={styles.title}>Lenta</LocalizedText>
          </View>
          <Pressable onPress={onMessages} style={styles.messagesButton} accessibilityLabel="Xabarlar">
            <Ionicons name="paper-plane-outline" size={17} color={c.primary} />
          </Pressable>
        </View>


        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
          <Pressable onPress={() => setActiveSection('feed')} style={[styles.sectionTab, activeSection === 'feed' && styles.sectionTabActive]}>
            <Ionicons name="newspaper-outline" size={16} color={activeSection === 'feed' ? '#FFFFFF' : c.textMuted} />
            <LocalizedText style={[styles.sectionTabText, activeSection === 'feed' && styles.sectionTabTextActive]}>Lenta</LocalizedText>
          </Pressable>
          <Pressable onPress={() => setActiveSection('clips')} style={styles.sectionTab}>
            <Ionicons name="play-circle-outline" size={17} color={c.textMuted} />
            <LocalizedText style={styles.sectionTabText}>Lavhalar</LocalizedText>
          </Pressable>
        </ScrollView>

        {activeSection === 'feed' && <>
        <View style={styles.storySection}>
          <View style={styles.storyHeading}>
            <LocalizedText style={styles.feedTitle}>Hikoyalar</LocalizedText>
            <LocalizedText style={styles.feedCaption}>24 soat davomida ko‘rinadi</LocalizedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyList}>
            <Pressable style={styles.storyItem} onPress={() => void publishStory()} disabled={storyBusy}>
              <View style={[styles.storyRing, styles.addStoryRing]}>
                {storyBusy ? <ActivityIndicator color={c.primary} /> : <Ionicons name="add" size={28} color={c.primary} />}
              </View>
              <LocalizedText style={styles.storyName}>Hikoya qo‘shish</LocalizedText>
            </Pressable>
            {stories.map((story) => (
              <Pressable key={story.id} style={styles.storyItem} onPress={() => void openStory(story)}>
                <View style={[styles.storyRing, story.viewed ? styles.storySeen : styles.storyUnseen]}>
                  {story.author.avatarUrl
                    ? <Image source={{ uri: story.author.avatarUrl }} style={styles.storyAvatar} />
                    : <View style={styles.storyFallback}><LocalizedText style={styles.avatarInitial}>{initials(story.author.displayName)}</LocalizedText></View>}
                </View>
                <LocalizedText style={styles.storyName} numberOfLines={1}>{story.isOwn ? 'Siz' : story.author.username}</LocalizedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.composer}>
          <View style={styles.composerTop}>
            <View style={styles.composerAvatar}><Ionicons name="person" size={18} color={c.primary} /></View>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Post yozing..."
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={2000}
              style={styles.input}
              textAlignVertical="top"
            />
          </View>
          {selectedImage && (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
              <Pressable onPress={() => setSelectedImage(null)} style={styles.removeImage}>
                <Ionicons name="close" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
          <View style={styles.composerBottom}>
            <View style={styles.composerTools}>
              <Pressable onPress={async () => {
                try { const asset = await pickImage(); if (asset) setSelectedImage(asset); }
                catch (error) { showLocalizedAlert('Rasm', error instanceof Error ? error.message : 'Rasm tanlanmadi'); }
              }} style={styles.attachButton}>
                <Ionicons name="image-outline" size={17} color={c.primary} />
                <LocalizedText style={styles.attachText}>Rasm</LocalizedText>
              </Pressable>
              <LocalizedText style={styles.counter}>{content.length}/2000</LocalizedText>
            </View>
            <Pressable disabled={(!content.trim() && !selectedImage) || posting} onPress={() => void publish()} style={[styles.publishButton, ((!content.trim() && !selectedImage) || posting) && { opacity: 0.5 }]}>
              {posting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="paper-plane" size={15} color="#FFFFFF" />}
              <LocalizedText style={styles.publishText}>Joylash</LocalizedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.feedHeading}>
          <LocalizedText style={styles.feedTitle}>Lenta</LocalizedText>
          <LocalizedText style={styles.feedCaption}>So‘nggi postlar</LocalizedText>
        </View>

        {loading ? <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 32 }} /> : feedError ? <View style={styles.empty}><Ionicons name="cloud-offline-outline" size={30} color={c.primary}/><LocalizedText style={styles.emptyTitle}>Lenta yuklanmadi</LocalizedText><LocalizedText style={styles.emptyText}>Internetni tekshirib, qayta urinib ko‘ring.</LocalizedText><Pressable onPress={()=>void load()} style={styles.emptyButton}><LocalizedText style={styles.emptyButtonText}>Qayta urinish</LocalizedText></Pressable></View> : posts.map((post) => (
          <View key={post.id} style={styles.post}>
            <View style={styles.postHeader}>
              {renderPerson(post.author)}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><LocalizedText style={styles.time}>{timeAgo(post.createdAt)}</LocalizedText>{post.isOwn ? <Pressable onPress={() => openPostActions(post)} hitSlop={10} accessibilityLabel="Post sozlamalari"><Ionicons name="ellipsis-horizontal" size={20} color={c.textMuted} /></Pressable> : null}</View>
            </View>
            {post.content ? <LocalizedText numberOfLines={5} style={styles.postContent}>{post.content}</LocalizedText> : null}
            {post.mediaUrl ? (post.mediaType?.startsWith('video/') ? <CommunityClipVideo uri={post.mediaUrl} /> : <Image source={{ uri: post.mediaUrl }} style={styles.postImage} resizeMode="cover" />) : null}
            <View style={styles.postActions}>
              <Pressable style={styles.action} onPress={() => void toggleLike(post)} disabled={busyPost === post.id}>
                <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={19} color={post.isLiked ? '#F05B82' : c.textMuted} />
                <LocalizedText style={[styles.actionText, post.isLiked && { color: '#F05B82' }]}>{post.likesCount}</LocalizedText>
              </Pressable>
              <Pressable style={styles.action} onPress={() => void openComments(post.id)}>
                <Ionicons name="chatbubble-outline" size={18} color={c.textMuted} />
                <LocalizedText style={styles.actionText}>{post.commentsCount} izoh</LocalizedText>
              </Pressable>
              <View style={{ flex: 1 }} />
              {post.isOwn && <LocalizedText style={styles.ownLabel}>SIZNING POSTINGIZ</LocalizedText>}
            </View>
            {expandedPost === post.id && (
              <View style={styles.comments}>
                {(comments[post.id] || []).map((comment) => (
                  <View key={comment.id} style={styles.comment}>
                    <LocalizedText style={styles.commentAuthor}>@{comment.author.username}</LocalizedText>
                    <LocalizedText numberOfLines={2} style={styles.commentText}>{comment.content}</LocalizedText>
                  </View>
                ))}
                {(comments[post.id] || []).length === 0 && <LocalizedText style={styles.noComments}>Hozircha izoh yo‘q. Birinchi bo‘lib yozing.</LocalizedText>}
                <View style={styles.commentComposer}>
                  <TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder="Izoh yozing..." placeholderTextColor={c.textMuted} style={styles.commentInput} maxLength={1000} />
                  <Pressable onPress={() => void sendComment(post.id)} disabled={!commentDraft.trim() || sendingComment} style={styles.commentSend}>
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))}

        {!loading && posts.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={34} color={c.primary} />
            <LocalizedText style={styles.emptyTitle}>Lenta hozircha bo‘sh</LocalizedText>
            <LocalizedText style={styles.emptyText}>Birinchi postni siz yozing yoki yangi bilimdonlarni toping.</LocalizedText>
            <Pressable onPress={onDiscoverUsers} style={styles.emptyButton}><LocalizedText style={styles.emptyButtonText}>Odamlarni topish</LocalizedText></Pressable>
          </View>
        )}
        </>}


      </ScrollView>}
      {activeSection !== 'clips' && <CommunityBottomNavigation active={activeSection} onNavigate={section => { if (section === 'home') setActiveSection('dashboard'); else if (section === 'messages') onMessages(); else setActiveSection(section); }} />}

      <Modal visible={Boolean(editingPost)} transparent animationType="slide" onRequestClose={() => setEditingPost(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><LocalizedText style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Postni tahrirlash</LocalizedText><Pressable onPress={() => setEditingPost(null)}><Ionicons name="close" size={23} color={c.text} /></Pressable></View>
            <TextInput value={editContent} onChangeText={setEditContent} multiline maxLength={2000} placeholder="Post matni..." placeholderTextColor={c.textMuted} style={{ minHeight: 120, maxHeight: 220, color: c.text, backgroundColor: c.surfaceElevated, borderRadius: 14, padding: 13, textAlignVertical: 'top' }} />
            <Pressable disabled={savingPostEdit} onPress={() => void savePostEdit()} style={{ minHeight: 46, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>{savingPostEdit ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={{ color: '#FFFFFF', fontWeight: '900' }}>Saqlash</LocalizedText>}</Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={clipComposerVisible} transparent animationType="slide" onRequestClose={() => { if (!clipBusy) setClipComposerVisible(false); }}>
        <View style={{flex:1,backgroundColor:'rgba(5,6,12,0.78)',justifyContent:'flex-end'}}>
          <ScrollView style={{backgroundColor:c.surface,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:'90%'}} contentContainerStyle={{padding:20,gap:12}} keyboardShouldPersistTaps="handled">
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><LocalizedText style={styles.feedTitle}>Yangi lavha</LocalizedText><Pressable onPress={() => { if (!clipBusy) setClipComposerVisible(false); }} disabled={clipBusy}><Ionicons name="close" size={23} color={c.text}/></Pressable></View>
            {selectedClip ? <View style={styles.selectedClipCard}><Ionicons name="videocam" size={22} color={c.primary}/><View style={{flex:1}}><LocalizedText style={styles.selectedClipName} numberOfLines={1}>{selectedClip.fileName || 'Tanlangan video'}</LocalizedText><LocalizedText style={styles.selectedClipMeta}>{selectedClip.fileSize ? `${(selectedClip.fileSize/(1024*1024)).toFixed(1)} MB` : 'Video'} · {selectedClip.duration ? `${Math.round(selectedClip.duration/1000)} soniya` : '90 soniyagacha'}</LocalizedText></View><Pressable onPress={() => { if (!clipBusy) { setSelectedClip(null); setClipUploadError(''); } }} disabled={clipBusy}><Ionicons name="close-circle" size={20} color={c.textMuted}/></Pressable></View> : <Pressable onPress={() => void chooseClip()} disabled={clipBusy} style={styles.chooseClipButton}><Ionicons name="videocam-outline" size={20} color={c.primary}/><LocalizedText style={styles.chooseClipText}>Galereyadan video tanlash</LocalizedText></Pressable>}
            <View style={{gap:6}}><LocalizedText style={styles.clipFieldLabel}>Video izohi (ixtiyoriy)</LocalizedText><TextInput value={clipCaption} onChangeText={setClipCaption} placeholder="Videongiz haqida yozing..." placeholderTextColor={c.textMuted} style={styles.clipCaptionInput} maxLength={2000} multiline/><LocalizedText style={styles.feedCaption}>{clipCaption.length}/2000 belgi · Bu matn video ostida ko‘rinadi.</LocalizedText></View>
            <LocalizedText style={styles.feedCaption}>Mavzu</LocalizedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>{['Matematika','Fizika','Informatika','Kimyo','Biologiya','Tarix','Til o‘rganish','Boshqa'].map(subject=><Pressable key={subject} onPress={()=>setClipSubject(subject)} style={{paddingHorizontal:11,paddingVertical:8,borderRadius:16,backgroundColor:clipSubject===subject?c.primary:c.background}}><LocalizedText style={{fontSize:11,fontWeight:'800',color:clipSubject===subject?'#fff':c.textMuted}}>{subject}</LocalizedText></Pressable>)}</ScrollView>
            {clipBusy ? <View style={styles.uploadProgressCard}><View style={styles.uploadProgressHeader}><View style={{flex:1,flexDirection:'row',alignItems:'center',gap:8}}><ActivityIndicator size="small" color={c.primary}/><LocalizedText style={styles.uploadProgressTitle}>{clipUploadStage || 'Yuklash boshlandi...'}</LocalizedText></View><LocalizedText style={styles.uploadProgressPercent}>{clipUploadProgress ?? 0}%</LocalizedText></View><View style={styles.uploadProgressTrack}><View style={[styles.uploadProgressFill,{width:`${clipUploadProgress ?? 0}%`}]} /></View><LocalizedText style={styles.uploadProgressHint}>{(clipUploadProgress ?? 0) >= 99 ? 'Fayl serverda tekshirilmoqda va lavha joylanmoqda. Oynani yopmang.' : 'Video yuklanmoqda. Yuklash tugaguncha shu oynani ochiq qoldiring.'}</LocalizedText></View> : null}
            {clipUploadError ? <View style={styles.uploadErrorCard}><Ionicons name="alert-circle-outline" size={20} color="#E06B6B"/><View style={{flex:1,gap:3}}><LocalizedText style={styles.uploadErrorTitle}>Video yuklanmadi</LocalizedText><LocalizedText style={styles.uploadErrorText}>{clipUploadError}</LocalizedText></View></View> : null}
            <Pressable onPress={() => void publishClip()} disabled={clipBusy || !selectedClip} style={[styles.publishClipButton,(!selectedClip||clipBusy)&&{opacity:0.55}]}>{clipBusy?<ActivityIndicator color="#fff"/>:<Ionicons name="cloud-upload-outline" size={18} color="#fff"/>}<LocalizedText style={styles.publishClipButtonText}>{clipBusy?'Yuklanmoqda...':clipUploadError?'Qayta urinish':'Videoni yuklash va joylash'}</LocalizedText></Pressable>
            <LocalizedText style={styles.clipGuidance}>MP4 (H.264) tavsiya etiladi · MOV va WEBM ham qabul qilinadi · 90 soniyagacha · 30 MB gacha.</LocalizedText>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedStory)} transparent animationType="fade" onRequestClose={() => setSelectedStory(null)}>
        {selectedStory && (
          <View style={styles.storyViewer}>
            <Image source={{ uri: selectedStory.mediaUrl }} style={styles.storyViewerImage} resizeMode="contain" />
            <View style={styles.storyViewerTop}>
              <View style={styles.storyViewerPerson}>
                {selectedStory.author.avatarUrl
                  ? <Image source={{ uri: selectedStory.author.avatarUrl }} style={styles.storyViewerAvatar} />
                  : <View style={styles.storyViewerAvatarFallback}><LocalizedText style={styles.storyViewerInitial}>{initials(selectedStory.author.displayName)}</LocalizedText></View>}
                <View>
                  <LocalizedText style={styles.storyViewerName}>{selectedStory.isOwn ? 'Siz' : selectedStory.author.displayName}</LocalizedText>
                  <LocalizedText style={styles.storyViewerTime}>{timeAgo(selectedStory.createdAt)}</LocalizedText>
                </View>
              </View>
              <Pressable onPress={() => setSelectedStory(null)} style={styles.storyClose}><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>
            </View>
            {selectedStory.caption ? <LocalizedText style={styles.storyCaption}>{selectedStory.caption}</LocalizedText> : null}
            {selectedStory.isOwn ? <View style={{ position: 'absolute', bottom: 28, left: 22, right: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><LocalizedText style={styles.storyViews}><Ionicons name="eye-outline" size={14} color="#FFFFFF" />  {selectedStory.viewsCount} ko‘rish</LocalizedText><Pressable onPress={() => deleteOwnStory(selectedStory)} style={{ padding: 10, borderRadius: 18, backgroundColor: 'rgba(180,40,60,0.75)' }}><Ionicons name="trash-outline" size={19} color="#FFFFFF" /></Pressable></View> : null}
          </View>
        )}
      </Modal>
      <Modal visible={Boolean(quizClip)} transparent animationType="fade" onRequestClose={() => setQuizClip(null)}>
        <View style={{flex:1,backgroundColor:'rgba(8,10,22,0.78)',justifyContent:'center',padding:18}}>
          <View style={{backgroundColor:c.surface,borderRadius:22,padding:18,maxHeight:'88%'}}>
            <View style={{flexDirection:'row',alignItems:'center',marginBottom:12}}><View style={{flex:1}}><LocalizedText style={styles.feedTitle}>Lavha mini-testi</LocalizedText><LocalizedText style={styles.feedCaption}>{quizClip?.content||'Bilimingizni sinab ko‘ring'}</LocalizedText></View><Pressable onPress={()=>setQuizClip(null)} style={styles.storyClose}><Ionicons name="close" size={21} color={c.text}/></Pressable></View>
            {quizLoading?<ActivityIndicator color={c.primary} style={{padding:24}}/>:quizClip?.isOwn&&(!clipQuiz||clipQuiz.canEdit)?<ScrollView keyboardShouldPersistTaps="handled">
              <LocalizedText style={styles.commentAuthor}>SAVOL</LocalizedText><TextInput value={quizQuestion} onChangeText={setQuizQuestion} placeholder="Video bo‘yicha savol yozing" placeholderTextColor={c.textMuted} style={styles.commentInput}/>
              <LocalizedText style={[styles.commentAuthor,{marginTop:12}]}>4 TA JAVOB VARIANTI</LocalizedText>
              {quizOptions.map((option,index)=><View key={index} style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:8}}><Pressable onPress={()=>setCorrectOption(index)} style={{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:correctOption===index?c.primary:c.background}}><LocalizedText style={{color:correctOption===index?'#fff':c.text,fontWeight:'900'}}>{String.fromCharCode(65+index)}</LocalizedText></Pressable><TextInput value={option} onChangeText={value=>setQuizOptions(current=>current.map((item,i)=>i===index?value:item))} placeholder={`${String.fromCharCode(65+index)} variant`} placeholderTextColor={c.textMuted} style={[styles.commentInput,{flex:1}]}/></View>)}
              <LocalizedText style={styles.feedCaption}>To‘g‘ri javobni chapdagi harfni bosib belgilang.</LocalizedText>
              <Pressable onPress={()=>void publishClipQuiz()} disabled={quizBusy} style={[styles.publishButton,{justifyContent:'center',marginTop:14}]}>{quizBusy?<ActivityIndicator color="#fff"/>:<Ionicons name="checkmark-circle-outline" size={17} color="#fff"/>}<LocalizedText style={styles.publishText}>{quizBusy?'Saqlanmoqda...':'Mini-testni saqlash'}</LocalizedText></Pressable>
            </ScrollView>:quizClip?.isOwn&&clipQuiz?<View style={{paddingVertical:20,alignItems:'center'}}><Ionicons name="lock-closed-outline" size={32} color={c.primary}/><LocalizedText style={styles.feedTitle}>Mini-test qulflangan</LocalizedText><LocalizedText style={styles.feedCaption}>Birinchi ishtirokchi javob berganidan keyin testni tahrirlab bo‘lmaydi.</LocalizedText></View>:clipQuiz? <ScrollView>
              <LocalizedText style={styles.postContent}>{clipQuiz.question}</LocalizedText>
              {(Array.isArray(clipQuiz.options) ? clipQuiz.options : []).slice(0,4).map((option,index)=><Pressable key={index} disabled={clipQuiz.attempted} onPress={()=>setSelectedOption(index)} style={{padding:12,borderRadius:12,marginBottom:8,backgroundColor:selectedOption===index?c.primary+'22':c.background,borderWidth:1,borderColor:selectedOption===index?c.primary:c.glassBorder}}><LocalizedText style={{color:c.text,fontSize:13,fontWeight:'700'}}>{String.fromCharCode(65+index)}. {option}</LocalizedText></Pressable>)}
              {clipQuiz.attempted?<LocalizedText style={{color:clipQuiz.isCorrect?'#2FA985':'#E28B58',fontWeight:'900',marginTop:8}}>{clipQuiz.isCorrect?'To‘g‘ri javob!':'Javob noto‘g‘ri.'} {clipQuiz.isCorrect?'5 XP va 2 ZC olindi.':''}</LocalizedText>:<Pressable onPress={()=>void submitClipQuiz()} disabled={selectedOption===null||quizBusy} style={[styles.publishButton,{justifyContent:'center',marginTop:10,opacity:selectedOption===null?0.5:1}]}>{quizBusy?<ActivityIndicator color="#fff"/>:<Ionicons name="checkmark" size={17} color="#fff"/>}<LocalizedText style={styles.publishText}>Javobni yuborish</LocalizedText></Pressable>}
            </ScrollView>:<View style={{paddingVertical:20,alignItems:'center'}}><Ionicons name="help-circle-outline" size={34} color={c.primary}/><LocalizedText style={styles.feedTitle}>Bu lavhada mini-test yo‘q</LocalizedText><LocalizedText style={styles.feedCaption}>Muallif hali test qo‘shmagan.</LocalizedText></View>}
          </View>
        </View>
      </Modal>
      <Modal visible={activeSection === 'clips' && Boolean(expandedPost)} transparent animationType="slide" onRequestClose={() => { setExpandedPost(null); setReplyingTo(null); }}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,6,12,0.72)' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setExpandedPost(null); setReplyingTo(null); }} />
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 22, maxHeight: '82%', minHeight: '42%' }}>
            <View onTouchStart={(event) => { commentSheetStartY.current = event.nativeEvent.pageY; }} onTouchEnd={(event) => { if (event.nativeEvent.pageY - commentSheetStartY.current > 90) { setExpandedPost(null); setReplyingTo(null); } }} style={{ width: 42, height: 5, borderRadius: 4, alignSelf: 'center', backgroundColor: c.textMuted, opacity: 0.45, marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View><LocalizedText style={styles.feedTitle}>Izohlar</LocalizedText><LocalizedText style={styles.feedCaption}>{expandedPost ? (clips.find((item) => item.id === expandedPost)?.commentsCount ?? 0) : 0} ta izoh</LocalizedText></View>
              <Pressable onPress={() => { setExpandedPost(null); setReplyingTo(null); }} accessibilityRole="button" accessibilityLabel="Izohlarni yopish"><Ionicons name="close" size={23} color={c.text}/></Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {expandedPost && commentsLoadingId === expandedPost ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator color={c.primary}/><LocalizedText style={styles.feedCaption}>Izohlar yuklanmoqda...</LocalizedText></View> : null}
              {(expandedPost ? comments[expandedPost] || [] : []).map((comment) => (
                <View key={comment.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <LocalizedText style={styles.commentAuthor}>@{comment.author.username}</LocalizedText>
                  <LocalizedText style={styles.commentText}>{comment.content}</LocalizedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
                    <Pressable onPress={() => setReplyingTo(comment)}><LocalizedText style={styles.feedCaption}>Javob berish</LocalizedText></Pressable>
                    {(comment.repliesCount || 0) > 0 ? <Pressable onPress={() => setExpandedReplies((current) => ({ ...current, [comment.id]: !current[comment.id] }))}><LocalizedText style={{ color: c.primary, fontSize: 11, fontWeight: '800' }}>{expandedReplies[comment.id] ? 'Javoblarni yashirish' : `${comment.repliesCount} ta javobni ko‘rish`}</LocalizedText></Pressable> : null}
                  </View>
                  {expandedReplies[comment.id] ? (comment.replies || []).map((reply) => <View key={reply.id} style={{ marginLeft: 18, marginTop: 9, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: c.primary }}><LocalizedText style={styles.commentAuthor}>@{reply.author.username}</LocalizedText><LocalizedText style={styles.commentText}>{reply.content}</LocalizedText></View>) : null}
                </View>
              ))}
              {expandedPost && commentsLoadingId !== expandedPost && (comments[expandedPost] || []).length === 0 ? <LocalizedText style={styles.feedCaption}>Hali izohlar yo‘q. Birinchi bo‘lib yozing.</LocalizedText> : null}
            </ScrollView>
            {replyingTo ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 }}><LocalizedText style={styles.feedCaption}>@{replyingTo.author.username} ga javob</LocalizedText><Pressable onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={18} color={c.textMuted}/></Pressable></View> : null}
            <View style={styles.commentComposer}>
              <TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder={replyingTo ? `@${replyingTo.author.username} ga javob yozing...` : 'Izoh yozing...'} placeholderTextColor={c.textMuted} style={styles.commentInput} maxLength={1000}/>
              <Pressable onPress={() => expandedPost && void sendComment(expandedPost, replyingTo?.id)} disabled={!commentDraft.trim() || sendingComment} style={[styles.commentSend, (!commentDraft.trim() || sendingComment) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Izohni yuborish"><Ionicons name="send" size={16} color="#FFFFFF"/></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(c: CommunityColors, isDark: boolean) {
  return StyleSheet.create({
    sectionTabs: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 16, padding: 4, marginBottom: 18, gap: 5 },
    sectionTab: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
    sectionTabActive: { backgroundColor: c.primary },
    sectionTabText: { color: c.textMuted, fontSize: 14, fontWeight: '700' },
    sectionTabTextActive: { color: '#FFFFFF' },
    clipsSection: { gap: 16, paddingBottom: 28 },
    clipGuidance: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: -6 },
    chooseClipButton: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: c.surface },
    chooseClipText: { color: c.primary, fontSize: 13, fontWeight: '800' },
    clipFieldLabel: { color: c.text, fontSize: 13, fontWeight: '800' },
    selectedClipCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    selectedClipIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.16)' : 'rgba(137,111,255,0.1)' },
    selectedClipName: { color: c.text, fontSize: 14, fontWeight: '700' },
    selectedClipMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    removeClipButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    uploadProgressCard: { borderRadius: 15, padding: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, gap: 9 },
    uploadProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    uploadProgressTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    uploadProgressPercent: { color: c.primary, fontSize: 13, fontWeight: '800' },
    uploadProgressTrack: { height: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: c.background },
    uploadProgressFill: { height: '100%', borderRadius: 8, backgroundColor: c.primary },
    uploadProgressHint: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    uploadErrorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13, backgroundColor: 'rgba(224,107,107,0.10)', borderWidth: 1, borderColor: 'rgba(224,107,107,0.35)' },
    uploadErrorTitle: { color: '#E06B6B', fontSize: 13, fontWeight: '900' },
    uploadErrorText: { color: c.text, fontSize: 12, lineHeight: 17 },
    publishClipButton: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: c.primary },
    publishClipButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

    clipCaptionInput: { minHeight: 48, borderRadius: 12, paddingHorizontal: 13, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, fontSize: 14 },
    clipsIntro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    clipsTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
    clipsSubtitle: { color: c.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
    createClipButton: { backgroundColor: c.primary, borderRadius: 13, minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
    createClipText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
    clipsEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 9, backgroundColor: c.surface, borderRadius: 20 },
    clipsEmptyTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    clipsEmptyText: { color: c.textMuted, fontSize: 13 },
    clipCard: { backgroundColor: c.surface, borderRadius: 26, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border },
    clipAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clipCaption: { color: c.text, fontSize: 14, lineHeight: 20 },
    clipActions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 4 },
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 112 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
    iconButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    eyebrow: { color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
    title: { color: c.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
    messagesButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverText: { color: c.primary, fontSize: 13, fontWeight: '700' },
    intro: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 26, padding: 17, marginBottom: 14, backgroundColor: isDark ? 'rgba(116,91,220,0.16)' : 'rgba(116,91,220,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    introIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    introTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    introSubtitle: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
    storySection: { marginBottom: 16 },
    storyHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
    storyList: { gap: 13, paddingVertical: 2, paddingRight: 10 },
    storyItem: { width: 66, alignItems: 'center', gap: 5 },
    storyRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', padding: 3 },
    addStoryRing: { borderWidth: 1.5, borderColor: c.glassBorder, backgroundColor: c.surface },
    storyUnseen: { borderWidth: 2.5, borderColor: '#8B5CF6' },
    storySeen: { borderWidth: 1.5, borderColor: c.textMuted },
    storyAvatar: { width: 50, height: 50, borderRadius: 25 },
    storyFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    storyName: { color: c.textMuted, fontSize: 11, maxWidth: 72 },
    composer: { padding: 16, borderRadius: 26, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 22 },
    composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    composerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.18)' : 'rgba(137,111,255,0.12)' },
    input: { flex: 1, minHeight: 62, maxHeight: 150, color: c.text, fontSize: 15, lineHeight: 21, paddingTop: 8 },
    imagePreviewWrap: { marginTop: 10, borderRadius: 15, overflow: 'hidden', alignSelf: 'flex-start', width: '100%', maxHeight: 220 },
    imagePreview: { width: '100%', height: 200, borderRadius: 15 },
    removeImage: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
    composerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11, marginTop: 8 },
    composerTools: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    attachButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34 },
    attachText: { color: c.primary, fontSize: 12, fontWeight: '700' },
    counter: { color: c.textMuted, fontSize: 12 },
    publishButton: { height: 37, borderRadius: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.primary },
    publishText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    feedHeading: { marginBottom: 10 },
    feedTitle: { color: c.text, fontSize: 17, fontWeight: '900' },
    feedCaption: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    post: { padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 11 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceElevated },
    avatarInitial: { color: c.text, fontSize: 12, fontWeight: '900' },
    name: { color: c.text, fontSize: 14, fontWeight: '800' },
    handle: { color: c.primary, fontSize: 12, marginTop: 2 },
    time: { color: c.textMuted, fontSize: 11 },
    postContent: { color: c.text, fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 12 },
    postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20, marginTop: 10, marginBottom: 12, backgroundColor: c.background },
    postActions: { flexDirection: 'row', alignItems: 'center', gap: 17, borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
    actionText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    ownLabel: { color: c.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
    comments: { borderTopWidth: 1, borderTopColor: c.glassBorder, marginTop: 10, paddingTop: 10 },
    comment: { paddingVertical: 6 },
    commentAuthor: { color: c.primary, fontSize: 12, fontWeight: '800' },
    commentText: { color: c.text, fontSize: 13, lineHeight: 19, marginTop: 2 },
    noComments: { color: c.textMuted, fontSize: 12, paddingVertical: 7 },
    commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    commentInput: { flex: 1, minHeight: 44, borderRadius: 13, paddingHorizontal: 12, color: c.text, backgroundColor: c.background, fontSize: 14 },
    commentSend: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    empty: { alignItems: 'center', padding: 30, borderRadius: 25, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginTop: 6 },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: '900', marginTop: 12 },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
    emptyButton: { marginTop: 14, paddingHorizontal: 16, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    emptyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    storyViewer: { flex: 1, backgroundColor: '#08080C', justifyContent: 'center' },
    storyViewerImage: { width: '100%', height: '100%', position: 'absolute' },
    storyViewerTop: { position: 'absolute', top: 55, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    storyViewerPerson: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    storyViewerAvatar: { width: 38, height: 38, borderRadius: 19 },
    storyViewerAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#33333D', alignItems: 'center', justifyContent: 'center' },
    storyViewerInitial: { color: '#FFFFFF', fontWeight: '900' },
    storyViewerName: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    storyViewerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
    storyClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    storyCaption: { position: 'absolute', bottom: 80, left: 22, right: 22, color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
    storyViews: { position: 'absolute', bottom: 32, left: 22, color: '#FFFFFF', fontSize: 11, flexDirection: 'row', alignItems: 'center' },
  });
}
