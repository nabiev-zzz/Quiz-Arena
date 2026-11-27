import React, { useEffect, useRef, useState } from 'react';
import { useEvent } from 'expo';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText } from '../i18n/LocalizedText';
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
  onComments: (id: string) => void;
  onMiniTest: (clip: CommunityPost) => void;
  onUserPress: (username: string) => void;
};

function Reel({ clip, active, height, muted, onMutedChange, onLike, onComments, onMiniTest, onUserPress }: {
  clip: CommunityPost; active: boolean; height: number; muted: boolean; onMutedChange: (muted: boolean) => void; onLike: Props['onLike']; onComments: Props['onComments']; onMiniTest: Props['onMiniTest']; onUserPress: Props['onUserPress'];
}) {
  const [paused, setPaused] = useState(false);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [playerStatus, setPlayerStatus] = useState<'idle' | 'loading' | 'readyToPlay' | 'error'>('idle');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  useEffect(() => { if (active) { setPlayerStatus('loading'); setPlaybackProgress(0); } }, [active, playerAttempt]);

  const togglePlayback = () => setPaused((value) => !value);
  const shareClip = async () => {
    try {
      await Share.share({ message: `${clip.content || 'ZELQEN Lavha'}\n${clip.mediaUrl || ''}` });
    } catch { /* Native share sheet can be dismissed without action. */ }
  };
  return (
    <View style={[styles.reel, { height }]}>
      {clip.mediaUrl && active ? <ActiveReelVideo key={`${clip.id}-${playerAttempt}`} uri={clip.mediaUrl} muted={muted} paused={paused} onStatusChange={setPlayerStatus} onProgressChange={setPlaybackProgress} /> : <View style={styles.noVideo}><Ionicons name={clip.mediaUrl ? 'play-circle-outline' : 'videocam-off-outline'} size={40} color="#FFFFFF"/><LocalizedText style={styles.emptyText}>{clip.mediaUrl ? 'Keyingi lavha' : 'Video mavjud emas'}</LocalizedText></View>}
      <Pressable style={StyleSheet.absoluteFill} onPress={togglePlayback} disabled={playerStatus === 'error'} accessibilityRole="button" accessibilityLabel={paused ? 'Videoni davom ettirish' : 'Videoni pauza qilish'} />
      {active && (playerStatus === 'loading' || playerStatus === 'idle') ? <View pointerEvents="none" style={styles.videoStatus}><ActivityIndicator size="large" color="#FFFFFF"/><LocalizedText style={styles.statusText}>Video yuklanmoqda...</LocalizedText></View> : null}
      {active && playerStatus === 'error' ? <View style={styles.videoStatus}><Ionicons name="alert-circle-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.statusText}>Videoni ochib bo‘lmadi</LocalizedText><LocalizedText style={styles.statusHint}>Internet yoki video formatini tekshiring.</LocalizedText><Pressable onPress={() => setPlayerAttempt((value) => value + 1)} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta yuklash</LocalizedText></Pressable></View> : null}
      {active ? <View pointerEvents="none" style={styles.progressTrack}><View style={[styles.progressFill, { width: `${playbackProgress}%` }]} /></View> : null}
      {paused && <View pointerEvents="none" style={styles.pauseMark}><Ionicons name="play" size={48} color="#FFFFFF" /></View>}
      <View pointerEvents="none" style={styles.shadeTop} />
      <View pointerEvents="none" style={styles.shadeBottom} />
      <Pressable onPress={() => onMutedChange(!muted)} style={styles.muteButton} accessibilityRole="button" accessibilityLabel={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" /></Pressable>
      <View style={styles.actions}>
        <Pressable onPress={() => onLike(clip)} style={styles.action}><Ionicons name={clip.isLiked ? 'heart' : 'heart-outline'} size={31} color={clip.isLiked ? '#FF4778' : '#FFFFFF'} /><LocalizedText style={styles.actionCount}>{clip.likesCount}</LocalizedText></Pressable>
        <Pressable onPress={() => onComments(clip.id)} style={styles.action}><Ionicons name="chatbubble-ellipses-outline" size={29} color="#FFFFFF"/><LocalizedText style={styles.actionCount}>{clip.commentsCount}</LocalizedText></Pressable>
        <Pressable onPress={() => void shareClip()} style={styles.action} accessibilityRole="button" accessibilityLabel="Lavhani ulashish"><Ionicons name="paper-plane-outline" size={28} color="#FFFFFF"/><LocalizedText style={styles.actionLabel}>Ulashish</LocalizedText></Pressable>
        <Pressable onPress={() => onMiniTest(clip)} style={styles.action}><Ionicons name="school-outline" size={29} color="#FFFFFF"/><LocalizedText style={styles.actionLabel}>Mini-test</LocalizedText></Pressable>
      </View>
      <View style={styles.captionBlock}>
        <Pressable onPress={() => onUserPress(clip.author.username)} style={styles.authorRow}>
          {clip.author.avatarUrl ? <Image source={{ uri: clip.author.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.avatarText}>{clip.author.displayName.slice(0,1).toUpperCase()}</LocalizedText></View>}
          <LocalizedText style={styles.authorName}>@{clip.author.username}</LocalizedText>
          <View style={styles.followPill}><LocalizedText style={styles.followText}>Profil</LocalizedText></View>
        </Pressable>
        {clip.content ? <LocalizedText numberOfLines={3} style={styles.caption}>{clip.content}</LocalizedText> : null}
        {clip.subject ? <LocalizedText style={styles.subject}>#{clip.subject}</LocalizedText> : null}
      </View>
    </View>
  );
}

function ActiveReelVideo({ uri, muted, paused, onStatusChange, onProgressChange }: { uri: string; muted: boolean; paused: boolean; onStatusChange: (status: 'idle' | 'loading' | 'readyToPlay' | 'error') => void; onProgressChange: (progress: number) => void }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.audioMixingMode = 'doNotMix';
    instance.timeUpdateEventInterval = 0.5;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  useEffect(() => { onStatusChange(status); }, [status, onStatusChange]);
  useEffect(() => {
    const duration = Number.isFinite(player.duration) ? player.duration : 0;
    onProgressChange(duration > 0 ? Math.min(100, Math.max(0, ((time?.currentTime ?? 0) / duration) * 100)) : 0);
  }, [player, time, onProgressChange]);
  useEffect(() => {
    player.muted = muted;
    if (paused || status === 'error') player.pause(); else if (status === 'readyToPlay') player.play();
  }, [player, muted, paused, status]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />;
}

export default function CommunityReelsFeed(props: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [height, setHeight] = useState(0);
  // Some Android WebView layouts report a zero initial onLayout height.
  // Use the available viewport until the measured container height arrives.
  const viewportHeight = height || Math.max(1, window.height - insets.top - insets.bottom);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const listRef = useRef<FlatList<CommunityPost>>(null);
  const previousHeightRef = useRef(0);
  const firstClipId = props.clips[0]?.id ?? null;
  const keyExtractor = (item: CommunityPost) => item.id;
  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [firstClipId]);
  useEffect(() => {
    if (viewportHeight > 0 && previousHeightRef.current > 0 && viewportHeight !== previousHeightRef.current) {
      listRef.current?.scrollToOffset({ offset: activeIndex * viewportHeight, animated: false });
    }
    if (viewportHeight > 0) previousHeightRef.current = viewportHeight;
  }, [viewportHeight, activeIndex]);
  return (
    <View style={styles.container} onLayout={(event) => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0 && next !== height) setHeight(next); }}>
      {props.loading ? <View style={styles.state}><LocalizedText style={styles.stateText}>Lavhalar yuklanmoqda...</LocalizedText></View> : props.error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Videolar yuklanmadi</LocalizedText><Pressable onPress={props.onRetry} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable></View> : props.clips.length === 0 ? <View style={styles.state}><Ionicons name="videocam-outline" size={48} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Hali lavhalar yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>Birinchi videoni siz joylang.</LocalizedText></View> : <FlatList ref={listRef} style={{ flex: 1 }} data={props.clips} removeClippedSubviews={false} keyExtractor={keyExtractor} renderItem={({ item, index }) => <Reel clip={item} active={index === activeIndex} height={viewportHeight} muted={muted} onMutedChange={setMuted} onLike={props.onLike} onComments={props.onComments} onMiniTest={props.onMiniTest} onUserPress={props.onUserPress}/>} pagingEnabled snapToInterval={viewportHeight} snapToAlignment="start" decelerationRate="fast" showsVerticalScrollIndicator={false} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor="#FFFFFF" colors={["#FFFFFF"]} />} onEndReached={() => { if (props.hasMore) props.onLoadMore(); }} onEndReachedThreshold={0.7} getItemLayout={(_, index) => ({ length: viewportHeight, offset: viewportHeight * index, index })} onMomentumScrollEnd={(event) => setActiveIndex(Math.min(props.clips.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / viewportHeight))))} onScrollToIndexFailed={({ index }) => { setActiveIndex(Math.min(index, props.clips.length - 1)); listRef.current?.scrollToOffset({ offset: Math.max(0, index) * viewportHeight, animated: false }); }} />}
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
  container:{flex:1,backgroundColor:'#05060A'}, reel:{width:'100%',backgroundColor:'#05060A',overflow:'hidden'},
  shadeTop:{position:'absolute',top:0,left:0,right:0,height:150,backgroundColor:'rgba(0,0,0,0.22)'}, shadeBottom:{position:'absolute',left:0,right:0,bottom:0,height:260,backgroundColor:'rgba(0,0,0,0.38)'},
  muteButton:{position:'absolute',top:112,right:16,width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.42)',zIndex:30,elevation:30},
  actions:{position:'absolute',right:12,bottom:128,alignItems:'center',gap:18,zIndex:30,elevation:30},action:{alignItems:'center',gap:5,minWidth:48,minHeight:54,justifyContent:'center',paddingHorizontal:5,paddingVertical:5,borderRadius:16,backgroundColor:'rgba(0,0,0,0.24)'},actionCount:{color:'#FFFFFF',fontSize:12,fontWeight:'900',textShadowColor:'#000',textShadowRadius:4},actionLabel:{color:'#FFFFFF',fontSize:10,fontWeight:'800',textShadowColor:'#000',textShadowRadius:4},
  captionBlock:{position:'absolute',left:16,right:82,bottom:28,gap:10,zIndex:30,elevation:30},authorRow:{flexDirection:'row',alignItems:'center',gap:9},avatar:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:'#FFFFFF'},avatarFallback:{width:36,height:36,borderRadius:18,backgroundColor:'#7359DF',alignItems:'center',justifyContent:'center'},avatarText:{color:'#FFFFFF',fontWeight:'900'},authorName:{color:'#FFFFFF',fontSize:13,fontWeight:'900',flexShrink:1},followPill:{borderWidth:1,borderColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:9,paddingVertical:4},followText:{color:'#FFFFFF',fontSize:10,fontWeight:'800'},caption:{color:'#FFFFFF',fontSize:13,lineHeight:19,textShadowColor:'#000',textShadowRadius:4},subject:{color:'#D8CEFF',fontSize:12,fontWeight:'900'},
  pauseMark:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},videoStatus:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'rgba(0,0,0,0.42)',padding:24},statusText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},statusHint:{color:'rgba(255,255,255,0.72)',fontSize:12,textAlign:'center'},progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:2,backgroundColor:'rgba(255,255,255,0.22)'},progressFill:{height:2,backgroundColor:'#FFFFFF'},noVideo:{flex:1,alignItems:'center',justifyContent:'center',gap:10},state:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:28},loadMore:{position:'absolute',bottom:22,alignSelf:'center',flexDirection:'row',paddingHorizontal:14,paddingVertical:9,alignItems:'center',gap:8,borderRadius:20,backgroundColor:'rgba(0,0,0,0.68)'},stateText:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},emptyText:{color:'rgba(255,255,255,0.7)',fontSize:13},retry:{paddingHorizontal:18,paddingVertical:10,borderRadius:12,backgroundColor:'#7359DF'},retryText:{color:'#FFFFFF',fontWeight:'900'},
  header:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:14,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(0,0,0,0.12)',zIndex:40,elevation:40},headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:21,backgroundColor:'rgba(0,0,0,0.24)'},headerTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900'}
});
