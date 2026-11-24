import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { leaderboardTheme as t, type LeaderboardPeriod, type LeaderboardUser } from './leaderboardTheme';

export function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[s.glass, style]}>
      <BlurView intensity={Platform.OS === 'android' ? 24 : 40} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.23)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

export function SegmentedControl({ value, onChange }: { value: LeaderboardPeriod; onChange: (v: LeaderboardPeriod) => void }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const opts: LeaderboardPeriod[] = ['Haftalik', 'Oylik', 'Hammasi'];
  const index = opts.indexOf(value);
  useEffect(() => { if (width) x.value = withSpring(index * width / 3, t.spring); }, [index, width, x]);
  const pill = useAnimatedStyle(() => ({ width: width / 3, transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={s.segment}>
      {width > 0 && <Animated.View style={[s.segmentPill, pill]}><LinearGradient colors={['rgba(255,255,255,0.34)','rgba(255,255,255,0.16)']} style={StyleSheet.absoluteFill} /></Animated.View>}
      {opts.map((o) => <Pressable key={o} onPress={() => onChange(o)} style={s.segmentItem}><Text style={[s.segmentText, value === o && s.segmentActive]}>{o}</Text></Pressable>)}
    </View>
  );
}

function Avatar({ user, place, size }: { user: LeaderboardUser; place: number; size: number }) {
  const ring = place === 1 ? t.gold : place === 2 ? t.silver : t.bronze;
  const colors = place === 1 ? ['#F7D77B','#C58A2B'] as const : place === 2 ? ['#DDEBFA','#7896B8'] as const : ['#E6A77E','#9C5B3E'] as const;
  return <View style={{width:size+10,height:size+10,borderRadius:99,borderWidth:2.5,borderColor:ring,alignItems:'center',justifyContent:'center'}}><LinearGradient colors={colors} style={{width:size,height:size,borderRadius:99,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#10243D',fontSize:size*.38,fontWeight:'900'}}>{user.name[0]}</Text></LinearGradient></View>;
}

export function Podium({ users }: { users: LeaderboardUser[] }) {
  const order = [users[1], users[0], users[2]];
  return <View style={s.podium}>{order.map((u,i) => {
    if (!u) return <View key={i} style={s.podiumSlot} />;
    const place = [2,1,3][i]; const first = place === 1;
    return <Animated.View key={u.id} entering={ZoomIn.delay(i*100).springify().damping(12)} style={s.podiumSlot}>
      {first && <Ionicons name="crown" size={23} color={t.gold} style={{marginBottom:4}} />}
      <Avatar user={u} place={place} size={first?76:60} />
      <Text numberOfLines={1} style={[s.podiumName,first&&{fontSize:15}]}>{u.name}</Text>
      <Text style={s.podiumXp}>{u.xp.toLocaleString('uz-UZ')} XP</Text>
      <View style={[s.podiumBlock,first?s.first:place===2?s.second:s.third]}><Text style={s.placeBig}>{place}</Text><Text style={s.placeSmall}>{place}-O‘RIN</Text></View>
    </Animated.View>;
  })}</View>;
}

export function LeaderRow({ user, index }: { user: LeaderboardUser; index: number }) {
  const mine = user.id === 'u4';
  const content = <View style={s.rowContent}>
    <Text style={s.placeNo}>{index+4}</Text>
    <LinearGradient colors={mine?['#8B5CF6','#22D3EE']:['rgba(34,211,238,.8)','rgba(99,102,241,.8)']} style={s.rowAvatar}><Text style={s.rowInitial}>{mine?'S':user.name[0]}</Text></LinearGradient>
    <View style={s.identity}>
      <View style={s.nameLine}><Text numberOfLines={1} style={s.rowName}>{mine?'Siz':user.name}</Text>{mine&&<Ionicons name="trending-up" size={15} color={t.success}/>}</View>
      <View style={s.rankLine}><Ionicons name="shield-checkmark" size={13} color="#A5D9FF"/><Text numberOfLines={1} style={s.rank}>{user.rank}</Text>{user.change>0&&<Text style={s.up}>↑ {user.change}</Text>}{user.change<0&&<Text style={s.down}>↓ {Math.abs(user.change)}</Text>}</View>
    </View>
    <View style={s.xp}><Text style={s.xpValue}>{user.xp.toLocaleString('uz-UZ')}</Text><Text style={s.xpLabel}>XP</Text></View>
  </View>;
  return <Animated.View entering={FadeInUp.delay(index*60).springify().damping(16)}>{mine?<LinearGradient colors={['rgba(139,92,246,.46)','rgba(34,211,238,.34)']} style={s.mine}>{content}</LinearGradient>:<GlassCard style={s.row}>{content}</GlassCard>}</Animated.View>;
}

const s = StyleSheet.create({
  glass:{overflow:'hidden',borderRadius:t.radius.card,borderWidth:1.5,borderTopColor:'rgba(255,255,255,.48)',borderLeftColor:'rgba(255,255,255,.34)',borderRightColor:'rgba(255,255,255,.13)',borderBottomColor:'rgba(255,255,255,.10)',backgroundColor:Platform.OS==='android'?'rgba(255,255,255,.13)':'rgba(255,255,255,.08)',shadowColor:'#001426',shadowOpacity:.22,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:8},
  segment:{height:54,marginTop:18,borderRadius:19,borderWidth:1,borderColor:'rgba(255,255,255,.22)',backgroundColor:'rgba(255,255,255,.09)',flexDirection:'row',padding:4,overflow:'hidden'},
  segmentPill:{position:'absolute',top:4,bottom:4,left:4,borderRadius:15,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.28)'},
  segmentItem:{flex:1,alignItems:'center',justifyContent:'center',zIndex:1},segmentText:{color:'rgba(255,255,255,.68)',fontSize:13,fontWeight:'700'},segmentActive:{color:'#fff'},
  podium:{flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:7,marginTop:28,marginBottom:22},podiumSlot:{flex:1,minWidth:0,alignItems:'center'},podiumName:{color:'#fff',fontSize:13,fontWeight:'800',marginTop:9,maxWidth:'100%'},podiumXp:{color:'rgba(255,255,255,.7)',fontSize:11,fontWeight:'700',marginTop:3,marginBottom:9},
  podiumBlock:{width:'100%',borderTopLeftRadius:17,borderTopRightRadius:17,alignItems:'center',justifyContent:'center',paddingTop:12,paddingBottom:12,borderWidth:1,borderBottomWidth:0},first:{height:86,backgroundColor:'rgba(248,212,119,.22)',borderColor:'rgba(248,212,119,.62)'},second:{height:62,backgroundColor:'rgba(215,229,245,.14)',borderColor:'rgba(215,229,245,.42)'},third:{height:48,backgroundColor:'rgba(217,154,112,.16)',borderColor:'rgba(217,154,112,.42)'},placeBig:{color:'#fff',fontSize:26,fontWeight:'900'},placeSmall:{color:'rgba(255,255,255,.7)',fontSize:8,fontWeight:'800',letterSpacing:1},
  row:{borderRadius:t.radius.row,marginBottom:10},mine:{borderRadius:t.radius.row,marginBottom:10,borderWidth:2,borderColor:'rgba(188,169,255,.78)',overflow:'hidden',shadowColor:'#8B5CF6',shadowOpacity:.24,shadowRadius:15,elevation:7},rowContent:{minHeight:78,flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:10},placeNo:{color:'rgba(255,255,255,.76)',width:26,fontSize:14,fontWeight:'900'},rowAvatar:{width:42,height:42,borderRadius:15,alignItems:'center',justifyContent:'center',marginRight:11},rowInitial:{color:'#fff',fontSize:17,fontWeight:'900'},identity:{flex:1,minWidth:0},nameLine:{flexDirection:'row',alignItems:'center',gap:5},rowName:{color:'#fff',fontSize:14,fontWeight:'800',flexShrink:1},rankLine:{flexDirection:'row',alignItems:'center',gap:4,marginTop:5},rank:{color:'rgba(255,255,255,.66)',fontSize:10,fontWeight:'600',flexShrink:1},up:{color:t.success,fontSize:10,fontWeight:'800'},down:{color:'#FDA4AF',fontSize:10,fontWeight:'800'},xp:{alignItems:'flex-end',marginLeft:8},xpValue:{color:'#fff',fontSize:15,fontWeight:'900'},xpLabel:{color:'rgba(255,255,255,.62)',fontSize:10,fontWeight:'700',marginTop:2},
});
