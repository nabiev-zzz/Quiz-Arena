import React, { useRef, useState } from 'react';
import { FlatList, Image, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
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
  onLike: (clip: CommunityPost) => void;
  onComments: (id: string) => void;
  onMiniTest: (clip: CommunityPost) => void;
  onUserPress: (username: string) => void;
};

function Reel({ clip, active, height, onLike, onComments, onMiniTest, onUserPress }: {
  clip: CommunityPost; active: boolean; height: number; onLike: Props['onLike']; onComments: Props['onComments']; onMiniTest: Props['onMiniTest']; onUserPress: Props['onUserPress'];
}) {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayer(clip.mediaUrl || '', (p) => { p.loop = true; p.muted = true; });
  React.useEffect(() => {
    player.muted = muted;
    if (active && !paused) player.play(); else player.pause();
  }, [active, muted, paused, player]);
  const togglePlayback = () => setPaused((value) => !value);
  return (
    <View style={[styles.reel, { height }]}>
      {clip.mediaUrl ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : <View style={styles.noVideo}><Ionicons name="videocam-off-outline" size={40} color="#FFFFFF"/><LocalizedText style={styles.emptyText}>Video mavjud emas</LocalizedText></View>}
      <Pressable style={StyleSheet.absoluteFill} onPress={togglePlayback} />
      {paused && <View pointerEvents="none" style={styles.pauseMark}><Ionicons name="play" size={48} color="#FFFFFF" /></View>}
      <View pointerEvents="none" style={styles.shadeTop} />
      <View pointerEvents="none" style={styles.shadeBottom} />
      <Pressable onPress={() => setMuted((value) => !value)} style={styles.muteButton}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" /></Pressable>
      <View style={styles.actions}>
        <Pressable onPress={() => onLike(clip)} style={styles.action}><Ionicons name={clip.isLiked ? 'heart' : 'heart-outline'} size={31} color={clip.isLiked ? '#FF4778' : '#FFFFFF'} /><LocalizedText style={styles.actionCount}>{clip.likesCount}</LocalizedText></Pressable>
        <Pressable onPress={() => onComments(clip.id)} style={styles.action}><Ionicons name="chatbubble-ellipses-outline" size={29} color="#FFFFFF"/><LocalizedText style={styles.actionCount}>{clip.commentsCount}</LocalizedText></Pressable>
        <Pressable onPress={() => void Share.share({ message: `${clip.content || 'ZELQEN Lavha'}\n${clip.mediaUrl || ''}` })} style={styles.action}><Ionicons name="paper-plane-outline" size={28} color="#FFFFFF"/><LocalizedText style={styles.actionLabel}>Ulashish</LocalizedText></Pressable>
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

export default function CommunityReelsFeed(props: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = Math.max(320, windowHeight - insets.top - insets.bottom);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<CommunityPost>>(null);
  const keyExtractor = (item: CommunityPost) => item.id;
  return (
    <View style={styles.container}>
      {props.loading ? <View style={styles.state}><LocalizedText style={styles.stateText}>Lavhalar yuklanmoqda...</LocalizedText></View> : props.error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={36} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Videolar yuklanmadi</LocalizedText><Pressable onPress={props.onRetry} style={styles.retry}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable></View> : props.clips.length === 0 ? <View style={styles.state}><Ionicons name="videocam-outline" size={48} color="#FFFFFF"/><LocalizedText style={styles.stateText}>Hali lavhalar yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>Birinchi videoni siz joylang.</LocalizedText></View> : <FlatList ref={listRef} data={props.clips} keyExtractor={keyExtractor} renderItem={({ item, index }) => <Reel clip={item} active={index === activeIndex} height={height} onLike={props.onLike} onComments={props.onComments} onMiniTest={props.onMiniTest} onUserPress={props.onUserPress}/>} pagingEnabled snapToInterval={height} snapToAlignment="start" decelerationRate="fast" showsVerticalScrollIndicator={false} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} getItemLayout={(_, index) => ({ length: height, offset: height * index, index })} onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.y / height))} />}
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
  muteButton:{position:'absolute',top:112,right:16,width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.3)'},
  actions:{position:'absolute',right:13,bottom:150,alignItems:'center',gap:22},action:{alignItems:'center',gap:5,minWidth:44},actionCount:{color:'#FFFFFF',fontSize:12,fontWeight:'900',textShadowColor:'#000',textShadowRadius:4},actionLabel:{color:'#FFFFFF',fontSize:10,fontWeight:'800',textShadowColor:'#000',textShadowRadius:4},
  captionBlock:{position:'absolute',left:16,right:78,bottom:32,gap:10},authorRow:{flexDirection:'row',alignItems:'center',gap:9},avatar:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:'#FFFFFF'},avatarFallback:{width:36,height:36,borderRadius:18,backgroundColor:'#7359DF',alignItems:'center',justifyContent:'center'},avatarText:{color:'#FFFFFF',fontWeight:'900'},authorName:{color:'#FFFFFF',fontSize:13,fontWeight:'900',flexShrink:1},followPill:{borderWidth:1,borderColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:9,paddingVertical:4},followText:{color:'#FFFFFF',fontSize:10,fontWeight:'800'},caption:{color:'#FFFFFF',fontSize:13,lineHeight:19,textShadowColor:'#000',textShadowRadius:4},subject:{color:'#D8CEFF',fontSize:12,fontWeight:'900'},
  pauseMark:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},noVideo:{flex:1,alignItems:'center',justifyContent:'center',gap:10},state:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:28},stateText:{color:'#FFFFFF',fontSize:17,fontWeight:'900'},emptyText:{color:'rgba(255,255,255,0.7)',fontSize:13},retry:{paddingHorizontal:18,paddingVertical:10,borderRadius:12,backgroundColor:'#7359DF'},retryText:{color:'#FFFFFF',fontWeight:'900'},
  header:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:14,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(0,0,0,0.12)'},headerButton:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:21,backgroundColor:'rgba(0,0,0,0.24)'},headerTitle:{color:'#FFFFFF',fontSize:17,fontWeight:'900'}
});