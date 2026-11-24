import { LocalizedText } from '../../i18n/LocalizedText';
import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GlassCard, LeaderRow, Podium, SegmentedControl } from './leaderboardComponents';
import { leaderboardMockData, leaderboardTheme as t, type LeaderboardPeriod } from './leaderboardTheme';
import { useTheme } from '../../theme/ThemeContext';

export default function LeaderboardScreen() {
  const { tokens, isDark } = useTheme();
  const colors = tokens.colors;
  const [period,setPeriod] = useState<LeaderboardPeriod>('Haftalik');
  const [refreshing,setRefreshing] = useState(false);
  const {width} = useWindowDimensions();
  const opacity = useSharedValue(1);
  const users = useMemo(() => {
    const multiplier = period==='Haftalik'?1:period==='Oylik'?1.35:1.8;
    return leaderboardMockData.map(u=>({...u,xp:Math.round(u.xp*multiplier)})).sort((a,b)=>b.xp-a.xp);
  },[period]);
  const changePeriod = (next:LeaderboardPeriod) => {
    opacity.value=withSpring(.35,t.spring,()=>{opacity.value=withSpring(1,t.spring);});
    setPeriod(next);
  };
  const animatedList = useAnimatedStyle(()=>({opacity:opacity.value}));
  const refresh = async()=>{setRefreshing(true);await new Promise(resolve=>setTimeout(resolve,400));setRefreshing(false);};
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <LinearGradient colors={isDark ? t.ocean : tokens.gradients.background} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob,styles.cyan,{left:-width*.24,top:70}]}/>
      <View style={[styles.blob,styles.indigo,{right:-width*.26,top:160}]}/>
      <View style={[styles.blob,styles.teal,{left:width*.35,bottom:120}]}/>
      <View style={[styles.blob,styles.blue,{right:-width*.2,bottom:340}]}/>
    </View>
    <Animated.ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary, colors.secondary]} progressBackgroundColor={colors.surface}/>}>
      <View style={styles.header}><View><LocalizedText style={[styles.eyebrow, { color: colors.textMuted }]}>QUIZ ARENA · LIDERLAR</LocalizedText><LocalizedText style={[styles.title, { color: colors.text }]}>Reyting</LocalizedText></View><GlassCard style={styles.star}><Ionicons name="star" size={21} color={t.gold}/></GlassCard></View>
      <GlassCard style={styles.league}><View style={styles.leagueIcon}><Ionicons name="shield-checkmark" size={17} color="#B9F4FF"/></View><View style={{flex:1}}><LocalizedText style={[styles.leagueTitle, { color: colors.text }]}>Usta ligasi</LocalizedText><LocalizedText style={[styles.leagueSub, { color: colors.textMuted }]}>Mavsum yakunlanishiga 3 kun qoldi</LocalizedText></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted}/></GlassCard>
      <SegmentedControl value={period} onChange={changePeriod}/>
      <View style={styles.heading}><LocalizedText style={[styles.sectionTitle, { color: colors.text }]}>Top bilimdonlar</LocalizedText><LocalizedText style={[styles.caption, { color: colors.textMuted }]}>{period}</LocalizedText></View>
      <Animated.View style={animatedList}>
        <Podium users={users.slice(0,3)}/>
        <View style={styles.heading}><LocalizedText style={[styles.sectionTitle, { color: colors.text }]}>Reyting jadvali</LocalizedText><LocalizedText style={[styles.caption, { color: colors.textMuted }]}>{users.length} ishtirokchi</LocalizedText></View>
        {users.slice(3).map((user,index)=><LeaderRow key={user.id} user={user} index={index}/>)}
        <GlassCard style={styles.note}><Ionicons name="sparkles" size={17} color={t.cyan}/><LocalizedText style={[styles.noteText, { color: colors.textSecondary }]}>Har bir to‘g‘ri javob seni yuqoriga olib chiqadi.</LocalizedText></GlassCard>
      </Animated.View>
    </Animated.ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#17112F',overflow:'hidden'},scroll:{flex:1},content:{paddingHorizontal:16,paddingTop:16,paddingBottom:132},
  blob:{position:'absolute',width:260,height:260,borderRadius:999,opacity:.54},cyan:{backgroundColor:'#22D3EE'},indigo:{width:300,height:300,backgroundColor:'#6366F1'},teal:{width:230,height:230,backgroundColor:'#2DD4BF'},blue:{width:200,height:200,backgroundColor:'#0EA5E9',opacity:.32},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},eyebrow:{color:'rgba(255,255,255,.56)',fontSize:9,fontWeight:'900',letterSpacing:2},title:{color:'#fff',fontSize:34,lineHeight:41,fontWeight:'900',letterSpacing:-.8,marginTop:3},star:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},
  league:{minHeight:68,borderRadius:22,paddingHorizontal:13,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10},leagueIcon:{width:38,height:38,borderRadius:14,backgroundColor:'rgba(34,211,238,.16)',alignItems:'center',justifyContent:'center'},leagueTitle:{color:'#fff',fontSize:13,fontWeight:'900'},leagueSub:{color:'rgba(255,255,255,.66)',fontSize:10,marginTop:3},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:25},sectionTitle:{color:'#fff',fontSize:17,fontWeight:'900'},caption:{color:'rgba(255,255,255,.60)',fontSize:11,fontWeight:'700'},note:{borderRadius:18,padding:14,flexDirection:'row',alignItems:'center',gap:9,marginTop:4},noteText:{color:'rgba(255,255,255,.76)',fontSize:11,fontWeight:'600',flex:1},
});
