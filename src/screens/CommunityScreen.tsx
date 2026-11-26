import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CommunityClipVideo from '../components/CommunityClipVideo';
import CommunityLearningHubScreen from './CommunityLearningHubScreen';
import * as ImagePicker from 'expo-image-picker';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import {
  addCommunityComment, createCommunityPost, createCommunityStory, getCommunityComments,
  getCommunityFeed, getCommunityStories, getCommunityClips, createCommunityClip, likeCommunityPost, markCommunityStoryViewed,
  unlikeCommunityPost, uploadCommunityMedia, getCommunityClipQuiz, createCommunityClipQuiz, answerCommunityClipQuiz,
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

export default function CommunityScreen({ onBack, onDiscoverUsers, onMessages, onChallenges, onDailyTasks, onTutor, onUserPress }: Props) {
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [clips, setClips] = useState<CommunityPost[]>([]);
  const [activeSection, setActiveSection] = useState<'feed' | 'clips' | 'groups' | 'questions' | 'library'>('feed');
  const [clipBusy, setClipBusy] = useState(false);
  const [clipSubject, setClipSubject] = useState('Boshqa');
  const [selectedClip, setSelectedClip] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [clipUploadProgress, setClipUploadProgress] = useState<number | null>(null);
  const [stories, setStories] = useState<CommunityStory[]>([]);
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
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
    try {
      const [feed, activeStories, videoClips] = await Promise.all([getCommunityFeed(), getCommunityStories(), getCommunityClips()]);
      setPosts(feed);
      setStories(activeStories);
      setClips(videoClips);
    } catch (error) {
      showLocalizedAlert('Hamjamiyat', error instanceof Error ? error.message : 'Lenta yuklanmadi');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      mediaTypes: ['videos'], allowsEditing: false, videoMaxDuration: 90, quality: 0.8,
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
    if (asset.mimeType === 'video/quicktime') return 'video/quicktime';
    if (asset.mimeType === 'video/webm') return 'video/webm';
    if (asset.mimeType === 'video/mp4') return 'video/mp4';
    const fileName = (asset.fileName || asset.uri).toLowerCase();
    if (fileName.endsWith('.mov')) return 'video/quicktime';
    if (fileName.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  };

  const chooseClip = async () => {
    if (clipBusy) return;
    try {
      const asset = await pickVideo();
      if (asset) { setSelectedClip(asset); setClipUploadProgress(null); }
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
      setClipUploadProgress(0);
      const media = await uploadCommunityMedia(selectedClip.uri, videoMime(selectedClip), setClipUploadProgress);
      const created = await createCommunityClip(content.trim(), media.mediaKey, media.mediaType, clipSubject);
      setClips((current) => [created, ...current]);
      setPosts((current) => [created, ...current]);
      setContent('');
      setClipSubject('Boshqa');
      setSelectedClip(null);
      setClipUploadProgress(null);
      setActiveSection('clips');
      showLocalizedAlert('Tayyor!', 'Video lavha muvaffaqiyatli joylandi.');
    } catch (error) {
      showLocalizedAlert('Video joylanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
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

  const openComments = async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    try {
      const loaded = await getCommunityComments(postId);
      setComments((current) => ({ ...current, [postId]: loaded }));
    } catch (error) { showLocalizedAlert('Izohlar', error instanceof Error ? error.message : 'Izohlar yuklanmadi'); }
  };

  const sendComment = async (postId: string) => {
    const text = commentDraft.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const comment = await addCommunityComment(postId, text);
      setComments((current) => ({ ...current, [postId]: [...(current[postId] || []), comment] }));
      const increment = (items: CommunityPost[]) => items.map((item) => item.id === postId ? { ...item, commentsCount: item.commentsCount + 1 } : item);
      setPosts(increment);
      setClips(increment);
      setCommentDraft('');
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

  if (activeSection === 'groups' || activeSection === 'questions' || activeSection === 'library') {
    return <CommunityLearningHubScreen onBack={() => setActiveSection('feed')} />;
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={c.primary} />}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={21} color={c.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.eyebrow}>ZELQEN SOCIAL</LocalizedText>
            <LocalizedText style={styles.title}>Hamjamiyat</LocalizedText>
          </View>
          <Pressable onPress={onMessages} style={styles.messagesButton} accessibilityLabel="Xabarlar">
            <Ionicons name="paper-plane-outline" size={17} color={c.primary} />
          </Pressable>
          <Pressable onPress={onChallenges} style={styles.messagesButton} accessibilityLabel="Bilim bellashuvlari">
            <Ionicons name="trophy-outline" size={17} color={c.primary} />
          </Pressable>
          <Pressable onPress={onDailyTasks} style={styles.messagesButton} accessibilityLabel="Kunlik vazifalar"><Ionicons name="calendar-outline" size={17} color={c.primary}/></Pressable>
          <Pressable onPress={onTutor} style={styles.messagesButton} accessibilityLabel="AI Ustoz"><Ionicons name="sparkles-outline" size={17} color={c.primary}/></Pressable>
          <Pressable onPress={onDiscoverUsers} style={styles.messagesButton} accessibilityLabel="Foydalanuvchilarni topish">
            <Ionicons name="people-outline" size={17} color={c.primary} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <View style={styles.introIcon}><Ionicons name="planet-outline" size={21} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.introTitle}>Bilimdonlar bir joyda</LocalizedText>
            <LocalizedText style={styles.introSubtitle}>Fikr ulashing, savol bering va bir-biringizdan o‘rganing.</LocalizedText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
          <Pressable onPress={() => setActiveSection('feed')} style={[styles.sectionTab, activeSection === 'feed' && styles.sectionTabActive]}>
            <Ionicons name="newspaper-outline" size={16} color={activeSection === 'feed' ? '#FFFFFF' : c.textMuted} />
            <LocalizedText style={[styles.sectionTabText, activeSection === 'feed' && styles.sectionTabTextActive]}>Lenta</LocalizedText>
          </Pressable>
          <Pressable onPress={() => setActiveSection('clips')} style={[styles.sectionTab, activeSection === 'clips' && styles.sectionTabActive]}>
            <Ionicons name="play-circle-outline" size={17} color={activeSection === 'clips' ? '#FFFFFF' : c.textMuted} />
            <LocalizedText style={[styles.sectionTabText, activeSection === 'clips' && styles.sectionTabTextActive]}>Lavhalar</LocalizedText>
          </Pressable>
          <Pressable onPress={() => setActiveSection('groups')} style={styles.sectionTab}>
            <Ionicons name="people-outline" size={16} color={c.textMuted} />
            <LocalizedText style={styles.sectionTabText}>Guruhlar</LocalizedText>
          </Pressable>
          <Pressable onPress={() => setActiveSection('questions')} style={styles.sectionTab}>
            <Ionicons name="help-circle-outline" size={16} color={c.textMuted} />
            <LocalizedText style={styles.sectionTabText}>Savol-javob</LocalizedText>
          </Pressable>
          <Pressable onPress={() => setActiveSection('library')} style={styles.sectionTab}>
            <Ionicons name="library-outline" size={16} color={c.textMuted} />
            <LocalizedText style={styles.sectionTabText}>Kutubxona</LocalizedText>
          </Pressable>
        </ScrollView>

        {activeSection === 'feed' && <>
        <View style={styles.storySection}>
          <View style={styles.storyHeading}>
            <LocalizedText style={styles.feedTitle}>Stories</LocalizedText>
            <LocalizedText style={styles.feedCaption}>24 soat davomida ko‘rinadi</LocalizedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyList}>
            <Pressable style={styles.storyItem} onPress={() => void publishStory()} disabled={storyBusy}>
              <View style={[styles.storyRing, styles.addStoryRing]}>
                {storyBusy ? <ActivityIndicator color={c.primary} /> : <Ionicons name="add" size={28} color={c.primary} />}
              </View>
              <LocalizedText style={styles.storyName}>Story qo‘shish</LocalizedText>
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
              placeholder="Bugun nimalarni o‘rgandingiz?"
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
          <LocalizedText style={styles.feedTitle}>Yangiliklar lentasi</LocalizedText>
          <LocalizedText style={styles.feedCaption}>Eng so‘nggi postlar</LocalizedText>
        </View>

        {loading ? <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 32 }} /> : posts.map((post) => (
          <View key={post.id} style={styles.post}>
            <View style={styles.postHeader}>
              {renderPerson(post.author)}
              <LocalizedText style={styles.time}>{timeAgo(post.createdAt)}</LocalizedText>
            </View>
            {post.content ? <LocalizedText style={styles.postContent}>{post.content}</LocalizedText> : null}
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
                    <LocalizedText style={styles.commentText}>{comment.content}</LocalizedText>
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

        {activeSection === 'clips' && (
          <View style={styles.clipsSection}>
            <View style={styles.clipsIntro}>
              <View style={{ flex: 1 }}>
                <LocalizedText style={styles.clipsTitle}>Qisqa videolar</LocalizedText>
                <LocalizedText style={styles.clipsSubtitle}>90 soniyagacha videolarni ulashing va tomosha qiling.</LocalizedText>
              </View>
              <Pressable onPress={() => void chooseClip()} disabled={clipBusy} style={[styles.createClipButton, clipBusy && { opacity: 0.65 }]}>
                <Ionicons name="folder-open-outline" size={17} color="#FFFFFF" />
                <LocalizedText style={styles.createClipText}>Videoni tanlash</LocalizedText>
              </Pressable>
            </View>
            <LocalizedText style={styles.clipGuidance}>1. Galereyadan video tanlang. 2. Izoh yozing. 3. Yuklashni bosing. MP4 tavsiya etiladi · 90 soniyagacha · 30 MB gacha.</LocalizedText>
            {selectedClip && (
              <View style={styles.selectedClipCard}>
                <View style={styles.selectedClipIcon}><Ionicons name="videocam" size={22} color={c.primary} /></View>
                <View style={{ flex: 1 }}>
                  <LocalizedText style={styles.selectedClipName} numberOfLines={1}>{selectedClip.fileName || 'Tanlangan video'}</LocalizedText>
                  <LocalizedText style={styles.selectedClipMeta}>{selectedClip.fileSize ? `${(selectedClip.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Hajmi aniqlanmoqda'} · {selectedClip.duration ? `${Math.round(selectedClip.duration / 1000)} soniya` : 'Video'}</LocalizedText>
                </View>
                <Pressable onPress={() => setSelectedClip(null)} disabled={clipBusy} style={styles.removeClipButton}><Ionicons name="close" size={18} color={c.textMuted} /></Pressable>
              </View>
            )}
            <TextInput value={content} onChangeText={setContent} placeholder="Video haqida qisqa izoh (ixtiyoriy)" placeholderTextColor={c.textMuted} style={styles.clipCaptionInput} maxLength={2000} />
            <LocalizedText style={styles.feedCaption}>Lavha mavzusi</LocalizedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingVertical:8}}>{['Matematika','Fizika','Informatika','Kimyo','Biologiya','Tarix','Til o‘rganish','Boshqa'].map(subject=><Pressable key={subject} onPress={()=>setClipSubject(subject)} style={{paddingHorizontal:11,paddingVertical:7,borderRadius:16,backgroundColor:clipSubject===subject?c.primary:c.surface,borderWidth:1,borderColor:clipSubject===subject?c.primary:c.border}}><LocalizedText style={{fontSize:10,fontWeight:'800',color:clipSubject===subject?'#fff':c.textMuted}}>{subject}</LocalizedText></Pressable>)}</ScrollView>
            {clipBusy && clipUploadProgress !== null && (
              <View style={styles.uploadProgressCard}>
                <View style={styles.uploadProgressHeader}>
                  <LocalizedText style={styles.uploadProgressTitle}>{clipUploadProgress >= 100 ? 'Video saqlandi' : 'Video yuklanmoqda...'}</LocalizedText>
                  <LocalizedText style={styles.uploadProgressPercent}>{clipUploadProgress}%</LocalizedText>
                </View>
                <View style={styles.uploadProgressTrack}><View style={[styles.uploadProgressFill, { width: `${clipUploadProgress}%` }]} /></View>
                <LocalizedText style={styles.uploadProgressHint}>Ilovadan chiqib ketmang. Yuklash tugagach video avtomatik joylanadi.</LocalizedText>
              </View>
            )}
            <Pressable onPress={() => void publishClip()} disabled={clipBusy || !selectedClip} style={[styles.publishClipButton, (clipBusy || !selectedClip) && { opacity: 0.48 }]}>
              {clipBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
              <LocalizedText style={styles.publishClipButtonText}>{clipBusy ? 'Yuklanmoqda...' : 'Yuklash va joylash'}</LocalizedText>
            </Pressable>
            {loading ? <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 30 }} /> : clips.length === 0 ? (
              <View style={styles.clipsEmpty}>
                <Ionicons name="videocam-outline" size={38} color={c.primary} />
                <LocalizedText style={styles.clipsEmptyTitle}>Hali videolar yo‘q</LocalizedText>
                <LocalizedText style={styles.clipsEmptyText}>Birinchi videoni siz joylang.</LocalizedText>
              </View>
            ) : clips.map((clip) => (
              <View key={clip.id} style={styles.clipCard}>
                <View style={styles.clipAuthor}>{renderPerson(clip.author)}<LocalizedText style={styles.time}>{timeAgo(clip.createdAt)}</LocalizedText></View>
                {clip.mediaUrl ? <CommunityClipVideo uri={clip.mediaUrl} /> : null}
                {clip.subject&&<LocalizedText style={styles.feedCaption}>#{clip.subject}</LocalizedText>}{clip.content ? <LocalizedText style={styles.clipCaption}>{clip.content}</LocalizedText> : null}
                <Pressable onPress={() => void openClipQuiz(clip)} style={[styles.action,{alignSelf:'flex-start',marginTop:8,backgroundColor:c.primary+'14',paddingHorizontal:11,paddingVertical:8,borderRadius:10}]}><Ionicons name="help-circle-outline" size={17} color={c.primary}/><LocalizedText style={[styles.actionText,{color:c.primary,fontWeight:'800'}]}>Mini-test</LocalizedText></Pressable>
                <View style={styles.clipActions}>
                  <Pressable style={styles.action} onPress={() => void toggleLike(clip)} disabled={busyPost === clip.id}>
                    <Ionicons name={clip.isLiked ? 'heart' : 'heart-outline'} size={20} color={clip.isLiked ? '#F05B82' : c.textMuted} />
                    <LocalizedText style={styles.actionText}>{clip.likesCount}</LocalizedText>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => void openComments(clip.id)}>
                    <Ionicons name="chatbubble-outline" size={18} color={c.textMuted} />
                    <LocalizedText style={styles.actionText}>{clip.commentsCount} izoh</LocalizedText>
                  </Pressable>
                </View>
                {expandedPost === clip.id && (
                  <View style={styles.comments}>
                    {(comments[clip.id] || []).map((comment) => <View key={comment.id} style={styles.comment}><LocalizedText style={styles.commentAuthor}>@{comment.author.username}</LocalizedText><LocalizedText style={styles.commentText}>{comment.content}</LocalizedText></View>)}
                    <View style={styles.commentComposer}>
                      <TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder="Izoh yozing..." placeholderTextColor={c.textMuted} style={styles.commentInput} maxLength={1000} />
                      <Pressable onPress={() => void sendComment(clip.id)} disabled={!commentDraft.trim() || sendingComment} style={styles.commentSend}><Ionicons name="send" size={16} color="#FFFFFF" /></Pressable>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
            {selectedStory.isOwn ? <LocalizedText style={styles.storyViews}><Ionicons name="eye-outline" size={14} color="#FFFFFF" />  {selectedStory.viewsCount} ko‘rish</LocalizedText> : null}
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
              {clipQuiz.options.map((option,index)=><Pressable key={index} disabled={clipQuiz.attempted} onPress={()=>setSelectedOption(index)} style={{padding:12,borderRadius:12,marginBottom:8,backgroundColor:selectedOption===index?c.primary+'22':c.background,borderWidth:1,borderColor:selectedOption===index?c.primary:c.glassBorder}}><LocalizedText style={{color:c.text,fontSize:13,fontWeight:'700'}}>{String.fromCharCode(65+index)}. {option}</LocalizedText></Pressable>)}
              {clipQuiz.attempted?<LocalizedText style={{color:clipQuiz.isCorrect?'#2FA985':'#E28B58',fontWeight:'900',marginTop:8}}>{clipQuiz.isCorrect?'To‘g‘ri javob!':'Javob noto‘g‘ri.'} {clipQuiz.isCorrect?'5 XP va 2 ZC olindi.':''}</LocalizedText>:<Pressable onPress={()=>void submitClipQuiz()} disabled={selectedOption===null||quizBusy} style={[styles.publishButton,{justifyContent:'center',marginTop:10,opacity:selectedOption===null?0.5:1}]}>{quizBusy?<ActivityIndicator color="#fff"/>:<Ionicons name="checkmark" size={17} color="#fff"/>}<LocalizedText style={styles.publishText}>Javobni yuborish</LocalizedText></Pressable>}
            </ScrollView>:<View style={{paddingVertical:20,alignItems:'center'}}><Ionicons name="help-circle-outline" size={34} color={c.primary}/><LocalizedText style={styles.feedTitle}>Bu lavhada mini-test yo‘q</LocalizedText><LocalizedText style={styles.feedCaption}>Muallif hali test qo‘shmagan.</LocalizedText></View>}
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    sectionTabs: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 16, padding: 4, marginBottom: 18, gap: 5 },
    sectionTab: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
    sectionTabActive: { backgroundColor: c.primary },
    sectionTabText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    sectionTabTextActive: { color: '#FFFFFF' },
    clipsSection: { gap: 16, paddingBottom: 28 },
    clipGuidance: { color: c.textMuted, fontSize: 11, lineHeight: 17, marginTop: -8 },
    selectedClipCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    selectedClipIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.16)' : 'rgba(137,111,255,0.1)' },
    selectedClipName: { color: c.text, fontSize: 12, fontWeight: '800' },
    selectedClipMeta: { color: c.textMuted, fontSize: 10, marginTop: 4 },
    removeClipButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    uploadProgressCard: { borderRadius: 15, padding: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, gap: 9 },
    uploadProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    uploadProgressTitle: { color: c.text, fontSize: 12, fontWeight: '800' },
    uploadProgressPercent: { color: c.primary, fontSize: 12, fontWeight: '900' },
    uploadProgressTrack: { height: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: c.background },
    uploadProgressFill: { height: '100%', borderRadius: 8, backgroundColor: c.primary },
    uploadProgressHint: { color: c.textMuted, fontSize: 10, lineHeight: 15 },
    publishClipButton: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: c.primary },
    publishClipButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

    clipCaptionInput: { minHeight: 44, borderRadius: 12, paddingHorizontal: 13, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, fontSize: 13 },
    clipsIntro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    clipsTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
    clipsSubtitle: { color: c.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
    createClipButton: { backgroundColor: c.primary, borderRadius: 13, minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
    createClipText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
    clipsEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 9, backgroundColor: c.surface, borderRadius: 20 },
    clipsEmptyTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    clipsEmptyText: { color: c.textMuted, fontSize: 13 },
    clipCard: { backgroundColor: c.surface, borderRadius: 26, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border },
    clipAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clipCaption: { color: c.text, fontSize: 14, lineHeight: 20 },
    clipActions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 4 },
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 150 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    eyebrow: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
    title: { color: c.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
    messagesButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverText: { color: c.primary, fontSize: 11, fontWeight: '800' },
    intro: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 26, padding: 17, marginBottom: 14, backgroundColor: isDark ? 'rgba(116,91,220,0.16)' : 'rgba(116,91,220,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    introIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    introTitle: { color: c.text, fontSize: 14, fontWeight: '900' },
    introSubtitle: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
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
    storyName: { color: c.textMuted, fontSize: 9, maxWidth: 66 },
    composer: { padding: 16, borderRadius: 26, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 22 },
    composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    composerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.18)' : 'rgba(137,111,255,0.12)' },
    input: { flex: 1, minHeight: 62, maxHeight: 150, color: c.text, fontSize: 13, lineHeight: 19, paddingTop: 8 },
    imagePreviewWrap: { marginTop: 10, borderRadius: 15, overflow: 'hidden', alignSelf: 'flex-start', width: '100%', maxHeight: 220 },
    imagePreview: { width: '100%', height: 200, borderRadius: 15 },
    removeImage: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
    composerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11, marginTop: 8 },
    composerTools: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    attachButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34 },
    attachText: { color: c.primary, fontSize: 10, fontWeight: '800' },
    counter: { color: c.textMuted, fontSize: 10 },
    publishButton: { height: 37, borderRadius: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.primary },
    publishText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    feedHeading: { marginBottom: 10 },
    feedTitle: { color: c.text, fontSize: 17, fontWeight: '900' },
    feedCaption: { color: c.textMuted, fontSize: 10, marginTop: 3 },
    post: { padding: 16, borderRadius: 26, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 11 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceElevated },
    avatarInitial: { color: c.text, fontSize: 12, fontWeight: '900' },
    name: { color: c.text, fontSize: 12, fontWeight: '900' },
    handle: { color: c.primary, fontSize: 10, marginTop: 2 },
    time: { color: c.textMuted, fontSize: 9 },
    postContent: { color: c.text, fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 13 },
    postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20, marginTop: 10, marginBottom: 12, backgroundColor: c.background },
    postActions: { flexDirection: 'row', alignItems: 'center', gap: 17, borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
    actionText: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
    ownLabel: { color: c.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
    comments: { borderTopWidth: 1, borderTopColor: c.glassBorder, marginTop: 10, paddingTop: 10 },
    comment: { paddingVertical: 6 },
    commentAuthor: { color: c.primary, fontSize: 10, fontWeight: '900' },
    commentText: { color: c.text, fontSize: 11, lineHeight: 16, marginTop: 2 },
    noComments: { color: c.textMuted, fontSize: 10, paddingVertical: 7 },
    commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    commentInput: { flex: 1, height: 40, borderRadius: 13, paddingHorizontal: 12, color: c.text, backgroundColor: c.background, fontSize: 11 },
    commentSend: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    empty: { alignItems: 'center', padding: 30, borderRadius: 25, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginTop: 6 },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: '900', marginTop: 12 },
    emptyText: { color: c.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
    emptyButton: { marginTop: 14, paddingHorizontal: 16, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    emptyButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
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
