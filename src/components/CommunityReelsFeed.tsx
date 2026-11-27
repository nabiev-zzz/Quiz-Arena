import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent, useEventListener } from 'expo';
import { ActivityIndicator, AppState, FlatList, Image, Modal, Pressable, RefreshControl, Share, StyleSheet, View, type ListViewToken } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { followUser, getPublicUserProfile, unfollowUser, type PublicUser } from '../services/userService';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { getDirectConversations, sendDirectMessage, startDirectConversation, type DirectConversation } from '../services/directMessagesService';
import { getCommunityClipPlayback, type CommunityPost } from '../services/communityService';

type Props = {
  clips: CommunityPost[]; loading: boolean; error: boolean; onBack: () => void; onUpload: () => void; onRetry: () => void;
  refreshing: boolean; onRefresh: () => void; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void;
  onLike: (clip: CommunityPost) => void; onSave: (clip: CommunityPost) => void; overlayOpen: boolean;
  onComments: (id: string) => void; onMiniTest: (clip: CommunityPost) => void; onUserPress: (username: string) => void;
};
type RegisterPlayer = (clipId: string, player: VideoPlayer | null) => void;

// Community is unmounted while opening messages/profiles; preserve the last page in this app session.
const feedSession: { clipId: string | null; index: number } = { clipId: null, index: 0 };

function isGoodPreloadConnection(state: NetInfoState) {
  if (state.isConnected !== true || state.isInternetReachable !== true || !state.details || state.details.isConnectionExpensive) return false;
  if (state.type === 'wifi') {
    const wifi = state.details as { strength?: number | null; linkSpeed?: number | null };
    const hasSignalMetrics = wifi.strength != null || wifi.linkSpeed != null;
    return hasSignalMetrics && (wifi.strength == null || wifi.strength >= 40) && (wifi.linkSpeed == null || wifi.linkSpeed >= 5);
  }
  if (state.type === 'cellular') {
    const cellular = state.details as { cellularGeneration?: string | null };
    return cellular.cellularGeneration === '4g' || cellular.cellularGeneration === '5g';
  }
  return state.type === 'ethernet';
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.max(0, value));
}

const Reel = memo(function Reel({ clip, index, active, shouldMountPlayer, height, bottomInset, muted, onMutedChange, onLike, onSave, onComments, onMiniTest, onUserPress, overlayOpen, appIsActive, registerPlayer, onSkip }: {
  clip: CommunityPost; index: number; active: boolean; shouldMountPlayer: boolean; height: number; bottomInset: number; muted: boolean;
  onMutedChange: (muted: boolean) => void; onLike: Props['onLike']; onSave: Props['onSave']; onComments: Props['onComments'];
  onMiniTest: Props['onMiniTest']; onUserPress: Props['onUserPress']; overlayOpen: boolean; appIsActive: boolean;
  registerPlayer: RegisterPlayer; onSkip: (index: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [shareConversations, setShareConversations] = useState<DirectConversation[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharingToId, setSharingToId] = useState<string | null>(null);
  const [followProfile, setFollowProfile] = useState<PublicUser | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [tapFeedback, setTapFeedback] = useState<'play' | 'pause' | null>(null);
  const [heartVisible, setHeartVisible] = useState(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeScale = useSharedValue(1);
  const heartScale = useSharedValue(0.6);
  const likeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));
  const heartAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const showFeedback = useCallback((kind: 'play' | 'pause') => {
    setTapFeedback(kind);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setTapFeedback(null), 520);
  }, []);
  const animateLike = useCallback((toggleLike: boolean) => {
    likeScale.value = withSequence(withSpring(1.3), withSpring(1));
    heartScale.value = 0.55;
    heartScale.value = withSequence(withSpring(1.25), withSpring(1));
    setHeartVisible(true);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    heartTimerRef.current = setTimeout(() => setHeartVisible(false), 650);
    if (toggleLike || !clip.isLiked) onLike(clip);
  }, [clip, heartScale, likeScale, onLike]);
  const handleLike = useCallback(() => animateLike(true), [animateLike]);
  const handleDoubleTapLike = useCallback(() => animateLike(false), [animateLike]);
  const handleVideoTap = useCallback(() => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current); tapTimerRef.current = null;
      handleDoubleTapLike(); setPaused(false); setTapFeedback(null); return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setPaused((current) => { const next = !current; showFeedback(next ? 'play' : 'pause'); return next; });
    }, 260);
  }, [handleDoubleTapLike, showFeedback]);
  useEffect(() => { if (active) setPaused(false); }, [active]);
  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
  }, []);
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    getPublicUserProfile(clip.author.username).then((profile) => { if (mounted) setFollowProfile(profile); }).catch(() => { if (mounted) setFollowProfile(null); });
    return () => { mounted = false; };
  }, [active, clip.author.username]);
  const toggleFollow = async () => {
    if (!followProfile || followProfile.isSelf || followBusy) return;
    const previous = followProfile; const following = !previous.isFollowing;
    setFollowProfile({ ...previous, isFollowing: following, followersCount: Math.max(0, previous.followersCount + (following ? 1 : -1)) });
    setFollowBusy(true);
    try {
      const result = following ? await followUser(previous.id) : await unfollowUser(previous.id);
      setFollowProfile((current) => current ? { ...current, isFollowing: result.following, followersCount: result.followersCount } : current);
    } catch (error) { setFollowProfile(previous); showLocalizedAlert('Kuzatish', error instanceof Error ? error.message : 'Amal bajarilmadi'); }
    finally { setFollowBusy(false); }
  };
  const shareClip = async () => {
    setShareVisible(false); setShareInProgress(true);
    try { await Share.share({ message: `${clip.content || 'ZELQEN Lavha'}\n${clip.mediaUrl || ''}` }); }
    catch { showLocalizedAlert('Ulashish', 'Lavhani ulashib bo‘lmadi.'); }
    finally { setShareInProgress(false); }
  };
  const openShareSheet = async () => {
    setShareVisible(true); setShareLoading(true);
    try { setShareConversations(await getDirectConversations()); }
    catch { setShareConversations([]); }
    finally { setShareLoading(false); }
  };
  const sendToUser = async (userId: string) => {
    if (!clip.mediaUrl || sharingToId) return;
    setSharingToId(userId);
    try {
      const conversation = await startDirectConversation(userId);
      await sendDirectMessage(conversation.id, `${(clip.content || 'ZELQEN Lavha').slice(0, 300)}\n${clip.mediaUrl}`);
      setShareVisible(false); showLocalizedAlert('Yuborildi', 'Lavha xabar orqali yuborildi.');
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
      {clip.mediaUrl && shouldMountPlayer ? <ReelVideoPlayer
        key={clip.id} clipId={clip.id} uri={clip.mediaUrl} active={active} muted={muted}
        paused={paused || overlayOpen || shareVisible || shareInProgress || !appIsActive} registerPlayer={registerPlayer}
        onProgressChange={setPlaybackProgress} onSkip={() => onSkip(index)}
      /> : <View style={styles.noVideo}><Ionicons name="play-circle-outline" size={40} color="#FFFFFF"/><LocalizedText style={styles.emptyText}>Keyingi lavha</LocalizedText></View>}
      <Pressable style={styles.videoTapLayer} onPress={handleVideoTap} accessibilityRole="button" accessibilityLabel={paused ? 'Videoni davom ettirish' : 'Videoni pauza qilish'} />
      {active ? <View pointerEvents="none" style={styles.progressTrack}><View style={[styles.progressFill, { width: `${playbackProgress}%` }]} /></View> : null}
      {tapFeedback ? <View pointerEvents="none" style={styles.pauseMark}><Ionicons name={tapFeedback === 'play' ? 'play' : 'pause'} size={52} color="#FFFFFF" /></View> : null}
      {heartVisible ? <Animated.View pointerEvents="none" style={[styles.heartMark, heartAnimatedStyle]}><Ionicons name="heart" size={92} color="#FFFFFF" /></Animated.View> : null}
      <View pointerEvents="none" style={styles.shadeTop} /><View pointerEvents="none" style={styles.shadeBottom} />
      <Pressable onPress={() => onMutedChange(!muted)} style={[styles.muteButton, { top: 72 + bottomInset * 0.15 }]} accessibilityRole="button" accessibilityLabel={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" /></Pressable>
      <View style={[styles.actions, { bottom: bottomInset + Math.max(104, height * 0.17) }]}>
        <Pressable onPress={handleLike} style={styles.action} accessibilityRole="button" accessibilityLabel={clip.isLiked ? 'Laykni olib tashlash' : 'Layk qo‘yish'} accessibilityState={{ selected: clip.isLiked }}><Animated.View style={likeAnimatedStyle}><Ionicons name={clip.isLiked ? 'heart' : 'heart-outline'} size={31} color={clip.isLiked ? '#FF4778' : '#FFFFFF'} /></Animated.View><LocalizedText style={styles.actionCount}>{formatCount(clip.likesCount)}</LocalizedText></Pressable>
        <Pressable onPress={() => onComments(clip.id)} style={styles.action}><Ionicons name="chatbubble-ellipses-outline" size={29} color="#FFFFFF"/><LocalizedText style={styles.actionCount}>{formatCount(clip.commentsCount)}</LocalizedText></Pressable>
        <Pressable onPress={() => void openShareSheet()} style={styles.action} accessibilityRole="button" accessibilityLabel="Lavhani ulashish"><Ionicons name="paper-plane-outline" size={28} color="#FFFFFF"/><LocalizedText style={styles.actionLabel}>Ulashish</LocalizedText></Pressable>
        <Pressable onPress={() => onSave(clip)} style={styles.action} accessibilityRole="button" accessibilityLabel={clip.isSaved ? 'Saqlangan lavhadan olib tashlash' : 'Lavhani saqlash'} accessibilityState={{ selected: Boolean(clip.isSaved) }}><Ionicons name={clip.isSaved ? 'bookmark' : 'bookmark-outline'} size={27} color={clip.isSaved ? '#F4D47A' : '#FFFFFF'}/><LocalizedText style={styles.actionLabel}>{clip.isSaved ? 'Saqlandi' : 'Saqlash'}</LocalizedText></Pressable>
        <Pressable onPress={() => onUserPress(clip.author.username)} style={styles.creatorAction} accessibilityRole="button" accessibilityLabel="Muallif profilini ochish">{clip.author.avatarUrl ? <Image source={{ uri: clip.author.avatarUrl }} style={styles.creatorAvatar}/> : <View style={styles.creatorAvatarFallback}><LocalizedText style={styles.creatorInitial}>{clip.author.displayName.slice(0,1).toUpperCase()}</LocalizedText></View>}{!clip.isOwn && !followProfile?.isFollowing ? <View style={styles.creatorPlus}><Ionicons name="add" size={12} color="#FFFFFF"/></View> : null}</Pressable>
      </View>
      <View style={[styles.captionBlock, { bottom: bottomInset + Math.max(18, height * 0.025) }]}>
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
            <View style={styles.shareHandle}/><LocalizedText style={styles.shareTitle}>Lavhani ulashish</LocalizedText>
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
});

function ReelVideoPlayer({ clipId, uri, active, muted, paused, registerPlayer, onProgressChange, onSkip }: {
  clipId: string; uri: string; active: boolean; muted: boolean; paused: boolean; registerPlayer: RegisterPlayer;
  onProgressChange: (progress: number) => void; onSkip: () => void;
}) {
  const [firstFrame, setFirstFrame] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [playbackRequestError, setPlaybackRequestError] = useState(false);
  const videoOpacity = useSharedValue(0);
  const posterOpacity = useSharedValue(1);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.audioMixingMode = 'doNotMix';
    instance.timeUpdateEventInterval = 0.5;
    instance.bufferOptions = { preferredForwardBufferDuration: active ? 18 : 8, minBufferForPlayback: 1 };
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const track = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack });
  const previousActiveRef = useRef(false);
  const videoStyle = useAnimatedStyle(() => ({ opacity: videoOpacity.value }));
  const posterStyle = useAnimatedStyle(() => ({ opacity: posterOpacity.value }));
  const loadPlayback = useCallback(async () => {
    setPlaybackReady(false);
    setPlaybackRequestError(false);
    setLoadTimedOut(false);
    setFirstFrame(false);
    videoOpacity.value = 0;
    posterOpacity.value = 1;
    try {
      const playback = await getCommunityClipPlayback(clipId);
      await player.replaceAsync(playback.url);
      setPlaybackReady(true);
    } catch {
      setPlaybackRequestError(true);
    }
  }, [clipId, player, posterOpacity, videoOpacity]);
  // Resolve a fresh, device-compatible MP4 URL on demand. This also repairs older clips lazily.
  useEffect(() => {
    if (active) void loadPlayback();
    else {
      setPlaybackReady(false);
      player.pause();
    }
  }, [active, loadPlayback, player]);
  // Always show the complete source frame; contain preserves every edge without cropping.
  const onTimeUpdate = useCallback(({ currentTime }: { currentTime: number }) => {
    if (!active) return;
    const duration = Number.isFinite(player.duration) ? player.duration : 0;
    onProgressChange(duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0);
  }, [active, onProgressChange, player]);
  useEventListener(player, 'timeUpdate', onTimeUpdate);

  useEffect(() => {
    if (!active || firstFrame || (playbackReady && status === 'error')) {
      setLoadTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setLoadTimedOut(true), 150_000);
    return () => clearTimeout(timeout);
  }, [active, firstFrame, status, uri, playbackReady]);

  useEffect(() => {
    registerPlayer(clipId, player);
    return () => registerPlayer(clipId, null);
  }, [clipId, player, registerPlayer]);
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (!active || !playbackReady) {
      player.pause();
      if (!active) {
        try { player.currentTime = 0; } catch { /* Player may still be initializing. */ }
        previousActiveRef.current = false;
      }
      return;
    }
    if (!previousActiveRef.current) {
      try { player.currentTime = 0; } catch { /* Player may still be initializing. */ }
      previousActiveRef.current = true;
    }
    if (paused || status === 'error') player.pause();
    else if (status === 'readyToPlay') player.play();
  }, [active, paused, playbackReady, player, status]);
  useEffect(() => {
    if (firstFrame) {
      videoOpacity.value = withTiming(1, { duration: 180 });
      posterOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [firstFrame, posterOpacity, videoOpacity]);

  const retry = () => {
    if (active) void loadPlayback();
  };

  if (!active) return null;
  return <>
    <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} surfaceType="textureView" onFirstFrameRender={() => setFirstFrame(true)} />
    </Animated.View>
    {!firstFrame ? <Animated.View pointerEvents="none" style={[styles.posterPlaceholder, posterStyle]}><Ionicons name="play-circle" size={48} color="#FFFFFF"/><LocalizedText style={styles.posterTitle}>ZELQEN</LocalizedText><LocalizedText style={styles.statusText}>Lavha yuklanmoqda...</LocalizedText><ActivityIndicator color="#FFFFFF" /></Animated.View> : null}
    {(playbackReady && status === 'error') || playbackRequestError || loadTimedOut ? <View pointerEvents="box-none" style={styles.videoStatus}><Ionicons name="alert-circle-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.statusText}>{loadTimedOut ? 'Video yuklanishi uzoq davom etdi' : 'Videoni ochib bo‘lmadi'}</LocalizedText><LocalizedText style={styles.statusHint}>Internetni tekshiring yoki qayta urinib ko‘ring.</LocalizedText><View style={styles.errorActions}><Pressable onPress={retry} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable><Pressable onPress={onSkip} style={styles.skipButton}><LocalizedText style={styles.retryText}>Keyingisi</LocalizedText></Pressable></View></View> : null}
  </>;
}

export default function CommunityReelsFeed(props: Props) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const heightRef = useRef(height); heightRef.current = height;
  const scrollOffsetRef = useRef(0);
  const playableClips = useMemo(() => props.clips.filter((clip) => typeof clip.mediaUrl === 'string' && clip.mediaUrl.trim().length > 0), [props.clips]);
  const clipsRef = useRef(playableClips); clipsRef.current = playableClips;
  const propsRef = useRef(props); propsRef.current = props;
  const [activeClipId, setActiveClipId] = useState<string | null>(feedSession.clipId);
  const [activeIndex, setActiveIndex] = useState(feedSession.index);
  const activeClipIdRef = useRef(activeClipId); activeClipIdRef.current = activeClipId;
  const activeIndexRef = useRef(feedSession.index);
  const [muted, setMuted] = useState(true);
  const [muteLoaded, setMuteLoaded] = useState(false);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === null || AppState.currentState === 'active');
  const [goodConnection, setGoodConnection] = useState(false);
  const listRef = useRef<FlatList<CommunityPost>>(null);
  const playerRegistry = useRef(new Map<string, VideoPlayer>());
  const restoredRef = useRef(false);
  const previousHeightRef = useRef(0);
  const loadRequestedAtLengthRef = useRef<number | null>(null);
  const previousLoadingMoreRef = useRef(props.loadingMore);

  useEffect(() => {
    let mounted = true;
    void SecureStore.getItemAsync('zelqen-lavhalar-muted').then((value) => {
      if (mounted && (value === 'true' || value === 'false')) setMuted(value === 'true');
    }).catch(() => undefined).finally(() => { if (mounted) setMuteLoaded(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if (muteLoaded) void SecureStore.setItemAsync('zelqen-lavhalar-muted', String(muted)).catch(() => undefined); }, [muted, muteLoaded]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setAppIsActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let mounted = true;
    const applyNetworkState = (state: NetInfoState) => { if (mounted) setGoodConnection(isGoodPreloadConnection(state)); };
    void NetInfo.fetch().then(applyNetworkState).catch(() => setGoodConnection(false));
    const unsubscribe = NetInfo.addEventListener(applyNetworkState);
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const registerPlayer = useCallback<RegisterPlayer>((clipId, player) => {
    if (player) playerRegistry.current.set(clipId, player);
    else playerRegistry.current.delete(clipId);
  }, []);
  const updateActiveIndex = useCallback((requestedIndex: number) => {
    const items = clipsRef.current;
    if (!items.length) return;
    const nextIndex = Math.min(items.length - 1, Math.max(0, requestedIndex));
    const nextId = items[nextIndex]?.id;
    if (!nextId) return;
    for (const [id, player] of playerRegistry.current) {
      if (id !== nextId) {
        player.pause();
        try { player.currentTime = 0; } catch { /* Player may still be initializing. */ }
      }
    }
    activeIndexRef.current = nextIndex;
    feedSession.index = nextIndex;
    feedSession.clipId = nextId;
    activeClipIdRef.current = nextId;
    setActiveIndex(nextIndex);
    setActiveClipId(nextId);
    const currentProps = propsRef.current;
    const remaining = items.length - nextIndex - 1;
    if (remaining <= 3 && currentProps.hasMore && !currentProps.loadingMore && loadRequestedAtLengthRef.current !== items.length) {
      loadRequestedAtLengthRef.current = items.length;
      currentProps.onLoadMore();
    }
  }, []);
  const updateActiveIndexRef = useRef(updateActiveIndex);
  updateActiveIndexRef.current = updateActiveIndex;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80, minimumViewTime: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    if (!restoredRef.current) return;
    const expectedIndex = heightRef.current > 0 ? Math.round(scrollOffsetRef.current / heightRef.current) : -1;
    const candidate = viewableItems.find((token) => token.isViewable && token.index === expectedIndex);
    if (!candidate || candidate.index === null) return;
    const index = clipsRef.current.findIndex((clip) => clip.id === (candidate.item as CommunityPost).id);
    if (index >= 0 && index === expectedIndex) updateActiveIndexRef.current(index);
  }).current;

  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (height > 0) {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      const nextIndex = Math.max(0, Math.round(offset / height));
      feedSession.index = nextIndex;
      feedSession.clipId = clipsRef.current[nextIndex]?.id ?? feedSession.clipId;
    }
  }, [height]);
  const onMomentumScrollEnd = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (height > 0) {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      updateActiveIndex(Math.round(event.nativeEvent.contentOffset.y / height));
    }
  }, [height, updateActiveIndex]);
  const onSkip = useCallback((index: number) => {
    const nextIndex = Math.min(clipsRef.current.length - 1, index + 1);
    if (nextIndex <= index || height <= 0) return;
    updateActiveIndex(nextIndex);
    scrollOffsetRef.current = nextIndex * height;
    listRef.current?.scrollToOffset({ offset: nextIndex * height, animated: true });
  }, [height, updateActiveIndex]);
  const requestMore = useCallback(() => {
    const currentProps = propsRef.current;
    if (!currentProps.hasMore || currentProps.loadingMore || loadRequestedAtLengthRef.current === clipsRef.current.length) return;
    loadRequestedAtLengthRef.current = clipsRef.current.length;
    currentProps.onLoadMore();
  }, []);

  useEffect(() => {
    if (loadRequestedAtLengthRef.current !== null && props.clips.length > loadRequestedAtLengthRef.current) loadRequestedAtLengthRef.current = null;
    if (previousLoadingMoreRef.current && !props.loadingMore) loadRequestedAtLengthRef.current = null;
    if (props.refreshing) loadRequestedAtLengthRef.current = null;
    previousLoadingMoreRef.current = props.loadingMore;
  }, [props.clips.length, props.loadingMore, props.refreshing]);

  useEffect(() => {
    if (height <= 0 || playableClips.length === 0) return;
    if (!restoredRef.current) {
      const savedIndex = feedSession.clipId ? playableClips.findIndex((clip) => clip.id === feedSession.clipId) : -1;
      const restoreIndex = savedIndex >= 0 ? savedIndex : Math.min(playableClips.length - 1, Math.max(0, feedSession.index));
      activeIndexRef.current = restoreIndex;
      const restoredId = playableClips[restoreIndex]?.id ?? null;
      activeClipIdRef.current = restoredId;
      setActiveIndex(restoreIndex);
      setActiveClipId(restoredId);
      feedSession.clipId = restoredId;
      feedSession.index = restoreIndex;
      scrollOffsetRef.current = restoreIndex * height;
      listRef.current?.scrollToOffset({ offset: restoreIndex * height, animated: false });
      restoredRef.current = true;
    } else if (previousHeightRef.current > 0 && previousHeightRef.current !== height) {
      scrollOffsetRef.current = activeIndexRef.current * height;
      listRef.current?.scrollToOffset({ offset: activeIndexRef.current * height, animated: false });
    }
    previousHeightRef.current = height;
  }, [height, playableClips]);

  useEffect(() => {
    const currentId = activeClipIdRef.current;
    if (!restoredRef.current || !currentId || height <= 0 || playableClips.length === 0) return;
    const currentIndex = playableClips.findIndex((clip) => clip.id === currentId);
    if (currentIndex < 0) {
      const fallbackIndex = Math.min(playableClips.length - 1, Math.max(0, activeIndexRef.current));
      updateActiveIndex(fallbackIndex);
      scrollOffsetRef.current = fallbackIndex * height;
      listRef.current?.scrollToOffset({ offset: fallbackIndex * height, animated: false });
    } else if (currentIndex !== activeIndexRef.current) {
      updateActiveIndex(currentIndex);
      scrollOffsetRef.current = currentIndex * height;
      listRef.current?.scrollToOffset({ offset: currentIndex * height, animated: false });
    }
  }, [height, playableClips, updateActiveIndex]);

  useEffect(() => () => {
    for (const player of playerRegistry.current.values()) player.pause();
    playerRegistry.current.clear();
  }, []);

  useEffect(() => {
    if (!props.loading && playableClips.length === 0 && props.clips.length > 0 && props.hasMore) requestMore();
  }, [playableClips.length, props.clips.length, props.hasMore, props.loading, requestMore]);

  const keyExtractor = useCallback((item: CommunityPost) => item.id, []);
  // Use the FlatList's actual viewport, not an ancestor's measured height.
  // Android can lay out the feed inside a smaller content area than the screen,
  // so paging by the outer container height can expose the next reel at once.
  const onListLayout = useCallback((event: { nativeEvent: { layout: { height: number } } }) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && next !== heightRef.current) setHeight(next);
  }, []);
  const getItemLayout = useCallback((_: ArrayLike<CommunityPost> | null | undefined, index: number) => ({ length: height, offset: height * index, index }), [height]);
  const renderItem = useCallback(({ item, index }: { item: CommunityPost; index: number }) => (
    <Reel
      clip={item} index={index} active={index === activeIndex}
      shouldMountPlayer={index === activeIndex || (goodConnection && index === activeIndex + 1)}
      height={height} bottomInset={insets.bottom} muted={muted} onMutedChange={setMuted}
      onLike={props.onLike} onSave={props.onSave} onComments={props.onComments} onMiniTest={props.onMiniTest}
      onUserPress={props.onUserPress} overlayOpen={props.overlayOpen} appIsActive={appIsActive}
      registerPlayer={registerPlayer} onSkip={onSkip}
    />
  ), [activeIndex, appIsActive, goodConnection, height, insets.bottom, muted, onSkip, props.onComments, props.onLike, props.onMiniTest, props.onSave, props.onUserPress, props.overlayOpen, registerPlayer]);

  return (
    <View style={styles.container} onLayout={onListLayout}>
      {height <= 0 ? <View style={styles.state}><ActivityIndicator color="#FFFFFF"/><LocalizedText style={styles.stateText}>Lavhalar tayyorlanmoqda...</LocalizedText></View>
        : props.loading ? <View style={styles.state}><View style={styles.skeletonPoster}/><View style={styles.skeletonLine}/><View style={styles.skeletonLineShort}/><ActivityIndicator color="#FFFFFF"/></View>
        : props.error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Videolar yuklanmadi</LocalizedText><Pressable onPress={props.onRetry} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable></View>
        : playableClips.length === 0 ? <View style={styles.state}><Ionicons name="videocam-outline" size={48} color="#FFFFFF"/><LocalizedText style={styles.stateText}>{props.clips.length ? 'Hozircha ko‘rish mumkin bo‘lgan lavha yo‘q' : 'Hali lavhalar yo‘q'}</LocalizedText><LocalizedText style={styles.emptyText}>{props.clips.length ? 'Mavjud bo‘lmagan videolar o‘tkazib yuborildi.' : 'Birinchi videoni siz joylang.'}</LocalizedText></View>
        : <FlatList
          ref={listRef} style={styles.list} data={playableClips} removeClippedSubviews={false}
          onLayout={onListLayout}
          keyExtractor={keyExtractor} renderItem={renderItem} pagingEnabled snapToInterval={height}
          snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
          showsVerticalScrollIndicator={false} initialNumToRender={1} maxToRenderPerBatch={2}
          windowSize={3} updateCellsBatchingPeriod={40}
          refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor="#FFFFFF" colors={['#FFFFFF']} />}
          onEndReached={requestMore} onEndReachedThreshold={3} getItemLayout={getItemLayout}
          viewabilityConfig={viewabilityConfig} onViewableItemsChanged={onViewableItemsChanged}
          onScroll={onScroll} scrollEventThrottle={16} onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={({ index }) => {
            updateActiveIndex(index);
            scrollOffsetRef.current = Math.max(0, index) * height;
            listRef.current?.scrollToOffset({ offset: Math.max(0, index) * height, animated: false });
          }}
        />}
      {props.loadingMore ? <View pointerEvents="none" style={styles.loadMore}><ActivityIndicator color="#FFFFFF"/><LocalizedText style={styles.emptyText}>Yana lavhalar yuklanmoqda...</LocalizedText></View> : null}
      {playableClips.length > 0 && activeIndex >= playableClips.length - 1 && !props.hasMore && !props.loadingMore ? <View pointerEvents="none" style={styles.endHint}><Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF"/><LocalizedText style={styles.endHintText}>Barcha lavhalarni ko‘rdingiz</LocalizedText></View> : null}
      <View style={[styles.header, { paddingTop: 8 }]}>
        <Pressable onPress={props.onBack} style={styles.headerButton}><Ionicons name="chevron-back" size={25} color="#FFFFFF"/></Pressable>
        <LocalizedText style={styles.headerTitle}>Lavhalar</LocalizedText>
        <Pressable onPress={props.onUpload} style={styles.headerButton}><Ionicons name="add" size={27} color="#FFFFFF"/></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#05060A',overflow:'hidden'},list:{flex:1},reel:{width:'100%',backgroundColor:'#05060A',overflow:'hidden'},
  videoTapLayer:{...StyleSheet.absoluteFill,zIndex:3,elevation:3},posterPlaceholder:{...StyleSheet.absoluteFill,zIndex:2,elevation:2,alignItems:'center',justifyContent:'center',gap:9,backgroundColor:'#10121B'},posterTitle:{color:'#FFFFFF',fontSize:18,fontWeight:'900',letterSpacing:3},
  shadeTop:{position:'absolute',top:0,left:0,right:0,height:150,zIndex:4,elevation:4,backgroundColor:'rgba(0,0,0,0.22)'},shadeBottom:{position:'absolute',left:0,right:0,bottom:0,height:280,zIndex:4,elevation:4,backgroundColor:'rgba(0,0,0,0.38)'},
  muteButton:{position:'absolute',right:16,width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.48)',zIndex:20,elevation:20},
  actions:{position:'absolute',right:10,alignItems:'center',gap:10,zIndex:30,elevation:30},action:{alignItems:'center',gap:4,width:52,minHeight:52,justifyContent:'center',paddingHorizontal:4,paddingVertical:4,borderRadius:15,backgroundColor:'rgba(0,0,0,0.3)'},actionCount:{color:'#FFFFFF',fontSize:12,fontWeight:'900',textShadowColor:'#000',textShadowRadius:4},actionLabel:{color:'#FFFFFF',fontSize:10,fontWeight:'800',textShadowColor:'#000',textShadowRadius:4},
  captionBlock:{position:'absolute',left:15,right:82,gap:8,zIndex:30,elevation:30},authorRow:{flexDirection:'row',alignItems:'center',gap:9},authorIdentity:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1},avatar:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:'#FFFFFF'},avatarFallback:{width:36,height:36,borderRadius:18,backgroundColor:'#7359DF',alignItems:'center',justifyContent:'center'},avatarText:{color:'#FFFFFF',fontWeight:'900'},authorName:{color:'#FFFFFF',fontSize:13,fontWeight:'900',flexShrink:1},followPill:{borderWidth:1,borderColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:9,paddingVertical:4},followText:{color:'#FFFFFF',fontSize:10,fontWeight:'800'},followingPill:{backgroundColor:'rgba(255,255,255,0.18)'},creatorAction:{width:48,height:48,alignItems:'center',justifyContent:'center'},creatorAvatar:{width:43,height:43,borderRadius:22,borderWidth:2,borderColor:'#FFFFFF'},creatorAvatarFallback:{width:43,height:43,borderRadius:22,backgroundColor:'#7359DF',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#FFFFFF'},creatorInitial:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},creatorPlus:{position:'absolute',bottom:-2,width:19,height:19,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#7359DF',borderWidth:1.5,borderColor:'#FFFFFF'},miniTestPill:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:'rgba(115,89,223,0.8)'},miniTestText:{color:'#FFFFFF',fontSize:11,fontWeight:'900'},caption:{color:'#FFFFFF',fontSize:13,lineHeight:19,textShadowColor:'#000',textShadowRadius:4},subject:{color:'#D8CEFF',fontSize:12,fontWeight:'900'},
  pauseMark:{...StyleSheet.absoluteFill,zIndex:12,elevation:12,alignItems:'center',justifyContent:'center'},heartMark:{...StyleSheet.absoluteFill,zIndex:13,elevation:13,alignItems:'center',justifyContent:'center'},videoStatus:{...StyleSheet.absoluteFill,zIndex:25,elevation:25,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'rgba(0,0,0,0.72)',padding:24},statusText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},statusHint:{color:'rgba(255,255,255,0.72)',fontSize:12,textAlign:'center'},errorActions:{flexDirection:'row',alignItems:'center',gap:10,marginTop:4},skipButton:{paddingHorizontal:18,paddingVertical:10,borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,0.65)'},
  progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:2,zIndex:35,elevation:35,backgroundColor:'rgba(255,255,255,0.22)'},progressFill:{height:2,backgroundColor:'#FFFFFF'},noVideo:{flex:1,alignItems:'center',justifyContent:'center',gap:10},state:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:28},skeletonPoster:{width:112,height:180,borderRadius:18,backgroundColor:'#202331'},skeletonLine:{width:'70%',height:12,borderRadius:8,backgroundColor:'#252838'},skeletonLineShort:{width:'42%',height:10,borderRadius:8,backgroundColor:'#252838'},loadMore:{position:'absolute',bottom:22,alignSelf:'center',flexDirection:'row',paddingHorizontal:14,paddingVertical:9,alignItems:'center',gap:8,borderRadius:20,backgroundColor:'rgba(0,0,0,0.68)'},stateText:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},emptyText:{color:'rgba(255,255,255,0.7)',fontSize:13},retry:{paddingHorizontal:18,paddingVertical:10,borderRadius:12,backgroundColor:'#7359DF'},retryText:{color:'#FFFFFF',fontWeight:'900'},
  endHint:{position:'absolute',bottom:12,alignSelf:'center',flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:13,paddingVertical:8,borderRadius:20,backgroundColor:'rgba(0,0,0,0.66)',zIndex:36,elevation:36},endHintText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},
  header:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:14,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(0,0,0,0.12)',zIndex:40,elevation:40},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:21,backgroundColor:'rgba(0,0,0,0.24)'},headerTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},
  shareBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.62)'},shareSheet:{maxHeight:'82%',overflow:'hidden',paddingHorizontal:22,paddingTop:12,paddingBottom:28,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:'#171923',gap:8},shareHandle:{width:38,height:4,borderRadius:3,alignSelf:'center',backgroundColor:'rgba(255,255,255,0.35)',marginBottom:8},shareTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900',marginBottom:5},shareOption:{minHeight:52,flexDirection:'row',alignItems:'center',gap:13,borderRadius:13,paddingHorizontal:12,backgroundColor:'rgba(255,255,255,0.07)'},shareOptionText:{color:'#FFFFFF',fontSize:14,fontWeight:'700'},shareSection:{color:'rgba(255,255,255,0.68)',fontSize:11,fontWeight:'900',marginTop:8},shareRecipient:{minHeight:50,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:8,borderRadius:12,backgroundColor:'rgba(255,255,255,0.06)'},shareRecipientAvatar:{width:34,height:34,borderRadius:17},shareRecipientFallback:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:'#7359DF'},shareFootnote:{color:'rgba(255,255,255,0.55)',fontSize:11,marginTop:4}
});
