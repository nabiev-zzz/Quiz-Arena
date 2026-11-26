import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView,
  StyleSheet, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import {
  addCommunityComment, createCommunityPost, getCommunityComments,
  getCommunityFeed, likeCommunityPost, unlikeCommunityPost,
  type CommunityComment, type CommunityPost,
} from '../services/communityService';

interface Props {
  onBack: () => void;
  onDiscoverUsers: () => void;
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

export default function CommunityScreen({ onBack, onDiscoverUsers, onUserPress }: Props) {
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setPosts(await getCommunityFeed()); }
    catch (error) { showLocalizedAlert('Hamjamiyat', error instanceof Error ? error.message : 'Lenta yuklanmadi'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publish = async () => {
    const text = content.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const created = await createCommunityPost(text);
      setPosts((current) => [created, ...current]);
      setContent('');
    } catch (error) {
      showLocalizedAlert('Post joylanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
    } finally { setPosting(false); }
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
    }
    catch (error) { showLocalizedAlert('Izohlar', error instanceof Error ? error.message : 'Izohlar yuklanmadi'); }
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={c.primary} />}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={21} color={c.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <LocalizedText style={styles.eyebrow}>ZELQEN SOCIAL</LocalizedText>
          <LocalizedText style={styles.title}>Hamjamiyat</LocalizedText>
        </View>
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
        <View style={styles.composerBottom}>
          <LocalizedText style={styles.counter}>{content.length}/2000</LocalizedText>
          <Pressable disabled={!content.trim() || posting} onPress={() => void publish()} style={[styles.publishButton, (!content.trim() || posting) && { opacity: 0.5 }]}>
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
          <LocalizedText style={styles.postContent}>{post.content}</LocalizedText>
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
    discoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverText: { color: c.primary, fontSize: 11, fontWeight: '800' },
    intro: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, marginBottom: 14, backgroundColor: isDark ? 'rgba(116,91,220,0.16)' : 'rgba(116,91,220,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    introIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    introTitle: { color: c.text, fontSize: 14, fontWeight: '900' },
    introSubtitle: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
    composer: { padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 22 },
    composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    composerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.18)' : 'rgba(137,111,255,0.12)' },
    input: { flex: 1, minHeight: 62, maxHeight: 150, color: c.text, fontSize: 13, lineHeight: 19, paddingTop: 8 },
    composerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11, marginTop: 8 },
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
  });
}
