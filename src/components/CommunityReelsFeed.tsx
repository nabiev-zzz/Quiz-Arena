import React, { useEffect, useRef, useState } from 'react';
import { useEvent, useEventListener } from 'expo';
import { ActivityIndicator, AppState, FlatList, Image, Modal, Pressable, RefreshControl, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { followUser, getPublicUserProfile, unfollowUser, type PublicUser } from '../services/userService';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { getDirectConversations, sendDirectMessage, startDirectConversation, type DirectConversation } from '../services/directMessagesService';
import type { CommunityPost } from '../services/communityService';

type Props = {
  clips: CommunityPost[];
  loading: boolean;
  error: boolean;
  onBack: () => void;
  onUpload: () => void;
  onRetry: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onLike: (clip: CommunityPost) => void;
  onSave: (clip: CommunityPost) => void;
  overlayOpen: boolean;
  onComments: (id: string) => void;
  onMiniTest: (clip: CommunityPost) => void;
  onUserPress: (username: string) => void;
};

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.max(0, value));
}

function Reel({ clip, active, height, bottomInset, muted, onMutedChange, onLike, onSave, onComments, onMiniTest, onUserPress, overlayOpen }: {
  clip: CommunityPost; active: boolean; height: number; bottomInset: number; muted: boolean; onMutedChange: (muted: boolean) => void; onLike: Props['onLike']; onSave: Props['onSave']; onComments: Props['onComments']; onMiniTest: Props['onMiniTest']; onUserPress: Props['onUserPress']; overlayOpen: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareConversations, setShareConversations] = useState<DirectConversation[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharingToId, setSharingToId] = useState<string | null>(null);
  const [followProfile, setFollowProfile] = useState<PublicUser | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const lastTapRef = useRef(0);
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));
  const handleLike = () => {
    // Reanimated shared values are intentionally mutated from this user-interaction callback.
    // eslint-disable-next-line react-hooks/immutability
    likeScale.value = withSequence(withSpring(1.3), withSpring(1));
    onLike(clip);
  };
  useEffect(() => { if (!active) return; let mounted = true; getPublicUserProfile(clip.author.username).then((profile) => { if (mounted) setFollowProfile(profile); }).catch(() => { if (mounted) setFollowProfile(null); }); return () => { mounted = false; }; }, [active, clip.author.username]);
  const toggleFollow = async () => { if (!followProfile || followProfile.isSelf || followBusy) return; const previous = followProfile; const following = !previous.isFollowing; setFollowProfile({ ...previous, isFollowing: following, followersCount: Math.max(0, previous.followersCount + (following ? 1 : -1)) }); setFollowBusy(true); try { const result = following ? await followUser(previous.id) : await unfollowUser(previous.id); setFollowProfile((current) => current ? { ...current, isFollowing: result.following, followersCount: result.followersCount } : current); } catch (error) { setFollowProfile(previous); showLocalizedAlert('Kuzatish', error instanceof Error ? error.message : 'Amal bajarilmadi'); } finally { setFollowBusy(false); } };
  const handleVideoTap = () => { const now = Date.now(); if (now - lastTapRef.current < 280) { handleLike(); setPaused(false); lastTapRef.current = 0; return; } lastTapRef.current = now; setPaused((value) => !value); };
  const shareClip = async () => {
    setShareVisible(false);
    try { await Share.share({ message: `${clip.content || 'ZELQEN Lavha'}\n${clip.mediaUrl || ''}` }); }
    catch { showLocalizedAlert('Ulashish', 'Lavhani ulashib bo‘lmadi.'); }
  };
  const openShareSheet = async () => {
    setShareVisible(true);
    setShareLoading(true);
    try { setShareConversations(await getDirectConversations()); }
    catch { setShareConversations([]); }
    finally { setShareLoading(false); }
  };
  const sendToUser = async (userId: string) => {
    if (!clip.mediaUrl || sharingToId) return;
    setSharingToId(userId);
    try {
      const conversation = await startDirectConversation(userId);
      const message = `${(clip.content || 'ZELQEN Lavha').slice(0, 300)}\n${clip.mediaUrl}`;
      await sendDirectMessage(conversation.id, message);
      setShareVisible(false);
      showLocalizedAlert('Yuborildi', 'Lavha xabar orqali yuborildi.');
    } catch (error) { showLocalizedAlert('Xabar yuborilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
    finally { setSharingToId(null); }
  };
  const copyClipLink = async () => {
    if (!clip.mediaUrl) return;
    try { await Clipboard.setStringAsync(clip.mediaUrl); setShareVisible(false); showLocalizedAlert('Nusxalandi', 'Video havolasi nusxalandi.'); }
    catch { showLocalizedAlert('Ulashish', 'Havolani nusxalab bo‘lmadi.'); }
  };
  return (
    <View style={[styles.reel, { height }]}>
      {clip.mediaUrl && active ? <ActiveReelVideo key={clip.id} uri={clip.mediaUrl} muted={muted} paused={paused || overlayOpen} onProgressChange={setPlaybackProgress} /> : <View style={styles.noVideo}><Ionicons name={clip.mediaUrl ? 'play-circle-outline' : 'videocam-off-outline'} size={40} color="#FFFFFF"/><LocalizedText style={styles.emptyText}>{clip.mediaUrl ? 'Keyingi lavha' : 'Video mavjud emas'}</LocalizedText></View>}
      <Pressable style={styles.videoTapLayer} onPress={handleVideoTap} accessibilityRole="button" accessibilityLabel={paused ? 'Videoni davom ettirish' : 'Videoni pauza qilish'} />
      {active ? <View pointerEvents="none" style={styles.progressTrack}><View style={[styles.progressFill, { width: `${playbackProgress}%` }]} /></View> : null}
      {paused && <View pointerEvents="none" style={styles.pauseMark}><Ionicons name="play" size={48} color="#FFFFFF" /></View>}
      <View pointerEvents="none" style={styles.shadeTop} />
      <View pointerEvents="none" style={styles.shadeBottom} />
      <Pressable onPress={() => onMutedChange(!muted)} style={styles.muteButton} accessibilityRole="button" accessibilityLabel={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" /></Pressable>
      <View style={[styles.actions, { bottom: bottomInset + 158 }]}>
        <Pressable onPress={handleLike} style={styles.action} accessibilityRole="button" accessibilityLabel={clip.isLiked ? 'Laykni olib tashlash' : 'Layk qo‘yish'} accessibilityState={{ selected: clip.isLiked }}><Animated.View style={likeAnimatedStyle}><Ionicons name={clip.isLiked ? 'heart' : 'heart-outline'} size={31} color={clip.isLiked ? '#FF4778' : '#FFFFFF'} /></Animated.View><LocalizedText style={styles.actionCount}>{formatCount(clip.likesCount)}</LocalizedText></Pressable>
        <Pressable onPress={() => onComments(clip.id)} style={styles.action}><Ionicons name="chatbubble-ellipses-outline" size={29} color="#FFFFFF"/><LocalizedText style={styles.actionCount}>{formatCount(clip.commentsCount)}</LocalizedText></Pressable>
        <Pressable onPress={() => void openShareSheet()} style={styles.action} accessibilityRole="button" accessibilityLabel="Lavhani ulashish"><Ionicons name="paper-plane-outline" size={28} color="#FFFFFF"/><LocalizedText style={styles.actionLabel}>Ulashish</LocalizedText></Pressable>
        <Pressable onPress={() => onSave(clip)} style={styles.action} accessibilityRole="button" accessibilityLabel={clip.isSaved ? 'Saqlangan lavhadan olib tashlash' : 'Lavhani saqlash'} accessibilityState={{ selected: Boolean(clip.isSaved) }}><Ionicons name={clip.isSaved ? 'bookmark' : 'bookmark-outline'} size={27} color={clip.isSaved ? '#F4D47A' : '#FFFFFF'}/><LocalizedText style={styles.actionLabel}>{clip.isSaved ? 'Saqlandi' : 'Saqlash'}</LocalizedText></Pressable>
        <Pressable onPress={() => onUserPress(clip.author.username)} style={styles.creatorAction} accessibilityRole="button" accessibilityLabel="Muallif profilini ochish">{clip.author.avatarUrl ? <Image source={{ uri: clip.author.avatarUrl }} style={styles.creatorAvatar}/> : <View style={styles.creatorAvatarFallback}><LocalizedText style={styles.creatorInitial}>{clip.author.displayName.slice(0,1).toUpperCase()}</LocalizedText></View>}{!clip.isOwn && !followProfile?.isFollowing ? <View style={styles.creatorPlus}><Ionicons name="add" size={12} color="#FFFFFF"/></View> : null}</Pressable>
      </View>
      <View style={[styles.captionBlock, { bottom: bottomInset + 24 }]}>
        <View style={styles.authorRow}>
          <Pressable onPress={() => onUserPress(clip.author.username)} style={styles.authorIdentity}>
            {clip.author.avatarUrl ? <Image source={{ uri: clip.author.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.avatarText}>{clip.author.displayName.slice(0,1).toUpperCase()}</LocalizedText></View>}
            <LocalizedText style={styles.authorName}>@{clip.author.username}</LocalizedText>
          </Pressable>
          {!clip.isOwn && followProfile && !followProfile.isSelf ? <Pressable onPress={() => void toggleFollow()} disabled={followBusy} style={[styles.followPill, followProfile.isFollowing && styles.followingPill]} accessibilityRole="button" accessibilityState={{ selected: Boolean(followProfile.isFollowing) }}><LocalizedText style={styles.followText}>{followBusy ? '...' : followProfile.isFollowing ? 'Kuzatilmoqda' : 'Kuzatish'}</LocalizedText></Pressable> : null}
        </View>
        {clip.content ? <Pressable onPress={() => setCaptionExpanded((value) => !value)}><LocalizedText numberOfLines={captionExpanded ? undefined : 2} style={styles.caption}>{clip.content}{!captionExpanded && clip.content.length > 90 ? '  ... yana' : ''}</LocalizedText></Pressable> : null}
        {clip.subject ? <LocalizedText style={styles.subject}>#{clip.subject}</LocalizedText> : null}
        <Pressable onPress={() => onMiniTest(clip)} style={styles.miniTestPill}><Ionicons name="school-outline" size={14} color="#FFFFFF"/><LocalizedText style={styles.miniTestText}>Mini-test</LocalizedText></Pressable>
      </View>
      <Modal visible={shareVisible} transparent animationType="fade" onRequestClose={() => setShareVisible(false)}>
        <Pressable style={styles.shareBackdrop} onPress={() => setShareVisible(false)}>
          <View style={styles.shareSheet}>
            <View style={styles.shareHandle}/>
            <LocalizedText style={styles.shareTitle}>Lavhani ulashish</LocalizedText>
            <Pressable style={styles.shareOption} onPress={() => void shareClip()}><Ionicons name="share-social-outline" size={22} color="#FFFFFF"/><LocalizedText style={styles.shareOptionText}>Boshqa ilovaga ulashish</LocalizedText></Pressable>
            <Pressable style={styles.shareOption} onPress={() => void copyClipLink()}><Ionicons name="copy-outline" size={22} color="#FFFFFF"/><LocalizedText style={styles.shareOptionText}>Video havolasini nusxalash</LocalizedText></Pressable>
            <LocalizedText style={styles.shareSection}>ZELQEN ichida yuborish</LocalizedText>
            {shareLoading ? <ActivityIndicator color="#FFFFFF"/> : shareConversations.length ? shareConversations.slice(0, 5).map((conversation) => <Pressable key={conversation.id} style={styles.shareRecipient} disabled={sharingToId !== null} onPress={() => void sendToUser(conversation.otherUser.id)}>{conversation.otherUser.avatarUrl ? <Image source={{ uri: conversation.otherUser.avatarUrl }} style={styles.shareRecipientAvatar}/> : <View style={styles.shareRecipientFallback}><LocalizedText style={styles.creatorInitial}>{conversation.otherUser.displayName.slice(0,1).toUpperCase()}</LocalizedText></View>}<View style={{ flex: 1 }}><LocalizedText style={styles.shareOptionText}>{conversation.otherUser.displayName}</LocalizedText><LocalizedText style={styles.shareFootnote}>@{conversation.otherUser.username}</LocalizedText></View>{sharingToId === conversation.otherUser.id ? <ActivityIndicator color="#FFFFFF"/> : <Ionicons name="send" size={17} color="#FFFFFF"/>}</Pressable>) : <LocalizedText style={styles.shareFootnote}>Hozircha mavjud suhbatlar topilmadi.</LocalizedText>}
            <LocalizedText style={styles.shareFootnote}>Havola vaqtinchalik media manzilidir.</LocalizedText>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActiveReelVideo({ uri, muted, paused, onProgressChange }: { uri: string; muted: boolean; paused: boolean; onProgressChange: (progress: number) => void }) {
  const [firstFrame, setFirstFrame] = useState(false);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.audioMixingMode = 'doNotMix';
    instance.timeUpdateEventInterval = 0.5;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const track = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack });
  const contentFit: 'contain' | 'cover' = track.videoTrack?.size?.width && track.videoTrack.size.height && track.videoTrack.size.width / track.videoTrack.size.height > 0.72 ? 'contain' : 'cover';
  useEventListener(player, 'timeUpdate', ({ currentTime }) => { const duration = Number.isFinite(player.duration) ? player.duration : 0; onProgressChange(duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0); });
  useEffect(() => {
    // expo-video exposes a mutable player object for imperative playback control.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
    if (paused || status === 'error') player.pause(); else if (status === 'readyToPlay') player.play();
  }, [player, muted, paused, status]);
  useEffect(() => { const subscription = AppState.addEventListener('change', (next) => { if (next !== 'active') player.pause(); else if (!paused && status === 'readyToPlay') player.play(); }); return () => subscription.remove(); }, [player, paused, status]);
  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={contentFit} nativeControls={false} surfaceType="textureView" onFirstFrameRender={() => setFirstFrame(true)} />
      {!firstFrame ? <View pointerEvents="none" style={styles.posterPlaceholder}><Ionicons name="play-circle" size={48} color="#FFFFFF"/><LocalizedText style={styles.posterTitle}>ZELQEN</LocalizedText><LocalizedText style={styles.statusText}>Lavha yuklanmoqda...</LocalizedText><ActivityIndicator color="#FFFFFF" /></View> : null}
      {(status === 'loading' || status === 'idle') && firstFrame ? <View pointerEvents="none" style={styles.videoStatus}><ActivityIndicator size="large" color="#FFFFFF"/><LocalizedText style={styles.statusText}>Video yuklanmoqda...</LocalizedText></View> : null}
      {status === 'error' ? <View style={styles.videoStatus}><Ionicons name="alert-circle-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.statusText}>Videoni ochib bo‘lmadi</LocalizedText><LocalizedText style={styles.statusHint}>Internet yoki video formatini tekshiring.</LocalizedText><Pressable onPress={() => { setFirstFrame(false); void player.replaceAsync(uri).catch(() => undefined); }} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable></View> : null}
    </>
  );
}

export default function CommunityReelsFeed(props: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [height, setHeight] = useState(0);
  // Some Android WebView layouts report a zero initial onLayout height.
  // Use the available viewport until the measured container height arrives.
  const viewportHeight = height || Math.max(1, window.height - insets.top - insets.bottom);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const activeIndex = Math.max(0, props.clips.findIndex((clip) => clip.id === activeClipId));
  const [muted, setMuted] = useState(true);
  const [muteLoaded, setMuteLoaded] = useState(false);
  useEffect(() => { let mounted = true; void SecureStore.getItemAsync('zelqen-lavhalar-muted').then((value) => { if (mounted && (value === 'true' || value === 'false')) setMuted(value === 'true'); }).catch(() => undefined).finally(() => { if (mounted) setMuteLoaded(true); }); return () => { mounted = false; }; }, []);
  useEffect(() => { if (muteLoaded) void SecureStore.setItemAsync('zelqen-lavhalar-muted', String(muted)).catch(() => undefined); }, [muted, muteLoaded]);
  const listRef = useRef<FlatList<CommunityPost>>(null);
  const previousHeightRef = useRef(0);
  const firstClipId = props.clips[0]?.id ?? 'empty';
  const keyExtractor = (item: CommunityPost) => item.id;
  useEffect(() => {
    if (viewportHeight > 0 && previousHeightRef.current > 0 && viewportHeight !== previousHeightRef.current) {
      listRef.current?.scrollToOffset({ offset: activeIndex * viewportHeight, animated: false });
    }
    if (viewportHeight > 0) previousHeightRef.current = viewportHeight;
  }, [viewportHeight, activeIndex]);
  return (
    <View style={styles.container} onLayout={(event) => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0 && next !== height) setHeight(next); }}>
      {props.loading ? <View style={styles.state}><LocalizedText style={styles.stateText}>Lavhalar yuklanmoqda...</LocalizedText></View> : props.error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Videolar yuklanmadi</LocalizedText><Pressable onPress={props.onRetry} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable></View> : props.clips.length === 0 ? <View style={styles.state}><Ionicons name="videocam-outline" size={48} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Hali lavhalar yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>Birinchi videoni siz joylang.</LocalizedText></View> : <FlatList key={firstClipId} ref={listRef} style={{ flex: 1 }} data={props.clips} removeClippedSubviews={false} keyExtractor={keyExtractor} renderItem={({ item, index }) => <Reel clip={item} active={index === activeIndex} height={viewportHeight} bottomInset={insets.bottom} muted={muted} onMutedChange={setMuted} onLike={props.onLike} onSave={props.onSave} onComments={props.onComments} onMiniTest={props.onMiniTest} onUserPress={props.onUserPress} overlayOpen={props.overlayOpen}/>} snapToInterval={viewportHeight} snapToAlignment="start" decelerationRate="fast" showsVerticalScrollIndicator={false} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor="#FFFFFF" colors={["#FFFFFF"]} />} onEndReached={() => { if (props.hasMore) props.onLoadMore(); }} onEndReachedThreshold={0.7} getItemLayout={(_, index) => ({ length: viewportHeight, offset: viewportHeight * index, index })} onMomentumScrollEnd={(event) => { const next = Math.min(props.clips.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / viewportHeight))); setActiveClipId(props.clips[next]?.id ?? null); }} onScrollToIndexFailed={({ index }) => { setActiveClipId(props.clips[Math.min(index, props.clips.length - 1)]?.id ?? null); listRef.current?.scrollToOffset({ offset: Math.max(0, index) * viewportHeight, animated: false }); }} />}
      {props.loadingMore ? <View pointerEvents="none" style={styles.loadMore}><ActivityIndicator color="#FFFFFF"/><LocalizedText style={styles.emptyText}>Yana lavhalar yuklanmoqda...</LocalizedText></View> : null}
      <View style={[styles.header, { paddingTop: Math.max(10, insets.top + 4) }]}>
        <Pressable onPress={props.onBack} style={styles.headerButton}><Ionicons name="chevron-back" size={25} color="#FFFFFF"/></Pressable>
        <LocalizedText style={styles.headerTitle}>Lavhalar</LocalizedText>
        <Pressable onPress={props.onUpload} style={styles.headerButton}><Ionicons name="add" size={27} color="#FFFFFF"/></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#05060A',overflow:'hidden'}, reel:{width:'100%',backgroundColor:'#05060A',overflow:'hidden'},
  videoTapLayer:{...StyleSheet.absoluteFill,zIndex:3,elevation:3}, posterPlaceholder:{...StyleSheet.absoluteFill,zIndex:2,elevation:2,alignItems:'center',justifyContent:'center',gap:9,backgroundColor:'#10121B'},posterTitle:{color:'#FFFFFF',fontSize:18,fontWeight:'900',letterSpacing:3},
  shadeTop:{position:'absolute',top:0,left:0,right:0,height:150,zIndex:4,elevation:4,backgroundColor:'rgba(0,0,0,0.22)'}, shadeBottom:{position:'absolute',left:0,right:0,bottom:0,height:280,zIndex:4,elevation:4,backgroundColor:'rgba(0,0,0,0.38)'},
  muteButton:{position:'absolute',top:112,right:16,width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.48)',zIndex:20,elevation:20},
  actions:{position:'absolute',right:10,bottom:158,alignItems:'center',gap:12,zIndex:30,elevation:30},action:{alignItems:'center',gap:4,width:52,minHeight:54,justifyContent:'center',paddingHorizontal:4,paddingVertical:5,borderRadius:15,backgroundColor:'rgba(0,0,0,0.3)'},actionCount:{color:'#FFFFFF',fontSize:12,fontWeight:'900',textShadowColor:'#000',textShadowRadius:4},actionLabel:{color:'#FFFFFF',fontSize:10,fontWeight:'800',textShadowColor:'#000',textShadowRadius:4},
  captionBlock:{position:'absolute',left:15,right:82,bottom:28,gap:9,zIndex:30,elevation:30},authorRow:{flexDirection:'row',alignItems:'center',gap:9},authorIdentity:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1},avatar:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:'#FFFFFF'},avatarFallback:{width:36,height:36,borderRadius:18,backgroundColor:'#7359DF',alignItems:'center',justifyContent:'center'},avatarText:{color:'#FFFFFF',fontWeight:'900'},authorName:{color:'#FFFFFF',fontSize:13,fontWeight:'900',flexShrink:1},followPill:{borderWidth:1,borderColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:9,paddingVertical:4},followText:{color:'#FFFFFF',fontSize:10,fontWeight:'800'},followingPill:{backgroundColor:'rgba(255,255,255,0.18)'},creatorAction:{width:48,height:48,alignItems:'center',justifyContent:'center'},creatorAvatar:{width:43,height:43,borderRadius:22,borderWidth:2,borderColor:'#FFFFFF'},creatorAvatarFallback:{width:43,height:43,borderRadius:22,backgroundColor:'#7359DF',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#FFFFFF'},creatorInitial:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},creatorPlus:{position:'absolute',bottom:-2,width:19,height:19,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#7359DF',borderWidth:1.5,borderColor:'#FFFFFF'},miniTestPill:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:'rgba(115,89,223,0.8)'},miniTestText:{color:'#FFFFFF',fontSize:11,fontWeight:'900'},caption:{color:'#FFFFFF',fontSize:13,lineHeight:19,textShadowColor:'#000',textShadowRadius:4},subject:{color:'#D8CEFF',fontSize:12,fontWeight:'900'},
  pauseMark:{...StyleSheet.absoluteFill,zIndex:10,elevation:10,alignItems:'center',justifyContent:'center'},videoStatus:{...StyleSheet.absoluteFill,zIndex:25,elevation:25,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'rgba(0,0,0,0.68)',padding:24},statusText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},statusHint:{color:'rgba(255,255,255,0.72)',fontSize:12,textAlign:'center'},progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:2,zIndex:35,elevation:35,backgroundColor:'rgba(255,255,255,0.22)'},progressFill:{height:2,backgroundColor:'#FFFFFF'},noVideo:{flex:1,alignItems:'center',justifyContent:'center',gap:10},state:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:28},loadMore:{position:'absolute',bottom:22,alignSelf:'center',flexDirection:'row',paddingHorizontal:14,paddingVertical:9,alignItems:'center',gap:8,borderRadius:20,backgroundColor:'rgba(0,0,0,0.68)'},stateText:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},emptyText:{color:'rgba(255,255,255,0.7)',fontSize:13},retry:{paddingHorizontal:18,paddingVertical:10,borderRadius:12,backgroundColor:'#7359DF'},retryText:{color:'#FFFFFF',fontWeight:'900'},
  header:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:14,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(0,0,0,0.12)',zIndex:40,elevation:40},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:21,backgroundColor:'rgba(0,0,0,0.24)'},headerTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},shareBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.62)'},shareSheet:{maxHeight:'82%',overflow:'hidden',paddingHorizontal:22,paddingTop:12,paddingBottom:28,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:'#171923',gap:8},shareHandle:{width:38,height:4,borderRadius:3,alignSelf:'center',backgroundColor:'rgba(255,255,255,0.35)',marginBottom:8},shareTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900',marginBottom:5},shareOption:{minHeight:52,flexDirection:'row',alignItems:'center',gap:13,borderRadius:13,paddingHorizontal:12,backgroundColor:'rgba(255,255,255,0.07)'},shareOptionText:{color:'#FFFFFF',fontSize:14,fontWeight:'700'},shareSection:{color:'rgba(255,255,255,0.68)',fontSize:11,fontWeight:'900',marginTop:8},shareRecipient:{minHeight:50,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:8,borderRadius:12,backgroundColor:'rgba(255,255,255,0.06)'},shareRecipientAvatar:{width:34,height:34,borderRadius:17},shareRecipientFallback:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:'#7359DF'},shareFootnote:{color:'rgba(255,255,255,0.55)',fontSize:11,marginTop:4}
});
