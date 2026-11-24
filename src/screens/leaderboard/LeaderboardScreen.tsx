import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GlassCard, LeaderRow, Podium, SegmentedControl } from './leaderboardComponents';
import { leaderboardMockData, leaderboardTheme as t, type LeaderboardPeriod } from './leaderboardTheme';

export default function LeaderboardScreen() {
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
  return <View style={styles.root}>
    <LinearGradient colors={t.ocean} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob,styles.cyan,{left:-width*.24,top:70}]}/>
      <View style={[styles.blob,styles.indigo,{right:-width*.26,top:160}]}/>
      <View style={[styles.blob,styles.teal,{left:width*.35,bottom:120}]}/>
      <View style={[styles.blob,styles.blue,{right:-width*.2,bottom:340}]}/>
    </View>
    <Animated.ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" colors={[t.cyan,t.teal]} progressBackgroundColor="rgba(255,255,255,.2)"/>}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>QUIZ ARENA · LIDERLAR</Text><Text style={styles.title}>Reyting</Text></View><GlassCard style={styles.star}><Ionicons name="star" size={21} color={t.gold}/></GlassCard></View>
      <GlassCard style={styles.league}><View style={styles.leagueIcon}><Ionicons name="shield-checkmark" size={17} color="#B9F4FF"/></View><View style={{flex:1}}><Text style={styles.leagueTitle}>Usta ligasi</Text><Text style={styles.leagueSub}>Mavsum yakunlanishiga 3 kun qoldi</Text></View><Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,.7)"/></GlassCard>
      <SegmentedControl value={period} onChange={changePeriod}/>
      <View style={styles.heading}><Text style={styles.sectionTitle}>Top bilimdonlar</Text><Text style={styles.caption}>{period}</Text></View>
      <Animated.View style={animatedList}>
        <Podium users={users.slice(0,3)}/>
        <View style={styles.heading}><Text style={styles.sectionTitle}>Reyting jadvali</Text><Text style={styles.caption}>{users.length} ishtirokchi</Text></View>
        {users.slice(3).map((user,index)=><LeaderRow key={user.id} user={user} index={index}/>)}
        <GlassCard style={styles.note}><Ionicons name="sparkles" size={17} color={t.cyan}/><Text style={styles.noteText}>Har bir to‘g‘ri javob seni yuqoriga olib chiqadi.</Text></GlassCard>
      </Animated.View>
    </Animated.ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#03304D',overflow:'hidden'},scroll:{flex:1},content:{paddingHorizontal:16,paddingTop:16,paddingBottom:132},
  blob:{position:'absolute',width:260,height:260,borderRadius:999,opacity:.54},cyan:{backgroundColor:'#22D3EE'},indigo:{width:300,height:300,backgroundColor:'#6366F1'},teal:{width:230,height:230,backgroundColor:'#2DD4BF'},blue:{width:200,height:200,backgroundColor:'#0EA5E9',opacity:.32},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},eyebrow:{color:'rgba(255,255,255,.56)',fontSize:9,fontWeight:'900',letterSpacing:2},title:{color:'#fff',fontSize:34,lineHeight:41,fontWeight:'900',letterSpacing:-.8,marginTop:3},star:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},
  league:{minHeight:68,borderRadius:22,paddingHorizontal:13,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10},leagueIcon:{width:38,height:38,borderRadius:14,backgroundColor:'rgba(34,211,238,.16)',alignItems:'center',justifyContent:'center'},leagueTitle:{color:'#fff',fontSize:13,fontWeight:'900'},leagueSub:{color:'rgba(255,255,255,.66)',fontSize:10,marginTop:3},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:25},sectionTitle:{color:'#fff',fontSize:17,fontWeight:'900'},caption:{color:'rgba(255,255,255,.60)',fontSize:11,fontWeight:'700'},note:{borderRadius:18,padding:14,flexDirection:'row',alignItems:'center',gap:9,marginTop:4},noteText:{color:'rgba(255,255,255,.76)',fontSize:11,fontWeight:'600',flex:1},
});
