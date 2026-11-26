import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import {
  addCommunityComment, createCommunityPost, createCommunityStory, getCommunityComments,
  getCommunityFeed, getCommunityStories, likeCommunityPost, markCommunityStoryViewed,
  unlikeCommunityPost, uploadCommunityMedia,
  type CommunityComment, type CommunityPost, type CommunityStory,
} from '../services/communityService';

interface Props {
  onBack: () => void;
  onDiscoverUsers: () => void;
  onMessages: () => void;
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

export default function CommunityScreen({ onBack, onDiscoverUsers, onMessages, onUserPress }: Props) {
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
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

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [feed, activeStories] = await Promise.all([getCommunityFeed(), getCommunityStories()]);
      setPosts(feed);
      setStories(activeStories);
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
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, isLiked: nextLiked, likesCount: Math.max(0, item.likesCount + (nextLiked ? 1 : -1)) }
      : item));
    try {
      const result = nextLiked ? await likeCommunityPost(post.id) : await unlikeCommunityPost(post.id);
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...result } : item));
    } catch (error) {
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, isLiked: post.isLiked, likesCount: post.likesCount }
        : item));
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
      setPosts((current) => current.map((item) => item.id === postId ? { ...item, commentsCount: item.commentsCount + 1 } : item));
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
          <Pressable onPress={onMessages} style={styles.messagesButton}>
            <Ionicons name="paper-plane-outline" size={17} color={c.primary} />
          </Pressable>
          <Pressable onPress={onDiscoverUsers} style={styles.discoverButton}>
            <Ionicons name="people-outline" size={17} color={c.primary} />
            <LocalizedText style={styles.discoverText}>Odamlar</LocalizedText>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <View style={styles.introIcon}><Ionicons name="planet-outline" size={21} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.introTitle}>Bilimdonlar bir joyda</LocalizedText>
            <LocalizedText style={styles.introSubtitle}>Fikr ulashing, savol bering va bir-biringizdan o‘rganing.</LocalizedText>
          </View>
        </View>

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
            {post.mediaUrl ? <Image source={{ uri: post.mediaUrl }} style={styles.postImage} resizeMode="cover" /> : null}
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
    </>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 150 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    eyebrow: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
    title: { color: c.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
    messagesButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverText: { color: c.primary, fontSize: 11, fontWeight: '800' },
    intro: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, marginBottom: 14, backgroundColor: isDark ? 'rgba(116,91,220,0.16)' : 'rgba(116,91,220,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    introIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    introTitle: { color: c.text, fontSize: 14, fontWeight: '900' },
    introSubtitle: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
    storySection: { marginBottom: 16 },
    storyHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
    storyList: { gap: 13, paddingVertical: 2, paddingRight: 10 },
    storyItem: { width: 66, alignItems: 'center', gap: 5 },
    storyRing: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', padding: 3 },
    addStoryRing: { borderWidth: 1.5, borderColor: c.glassBorder, backgroundColor: c.surface },
    storyUnseen: { borderWidth: 2.5, borderColor: '#8B5CF6' },
    storySeen: { borderWidth: 1.5, borderColor: c.textMuted },
    storyAvatar: { width: 50, height: 50, borderRadius: 25 },
    storyFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    storyName: { color: c.textMuted, fontSize: 9, maxWidth: 66 },
    composer: { padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 22 },
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
    post: { padding: 15, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 11 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceElevated },
    avatarInitial: { color: c.text, fontSize: 12, fontWeight: '900' },
    name: { color: c.text, fontSize: 12, fontWeight: '900' },
    handle: { color: c.primary, fontSize: 10, marginTop: 2 },
    time: { color: c.textMuted, fontSize: 9 },
    postContent: { color: c.text, fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 13 },
    postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 15, marginTop: 10, marginBottom: 12, backgroundColor: c.background },
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
    empty: { alignItems: 'center', padding: 28, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginTop: 6 },
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
