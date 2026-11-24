import { LocalizedText } from '../../i18n/LocalizedText';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { BattleLeaderboardEntry } from '../../services/battleService';

interface Props { leaderboard: BattleLeaderboardEntry[]; currentUserId?: string; loading?: boolean; error?: string; onRefresh?: () => void; }
const medals = ['trophy', 'medal', 'ribbon'] as const;
const medalColors = ['#F5C451', '#BFC8D8', '#D99A70'] as const;

export default function LeaderboardScreen({ leaderboard, currentUserId, loading = false, error = '', onRefresh }: Props) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  const s = makeStyles(c);
  const [refreshing, setRefreshing] = useState(false);
  const users = useMemo(() => [...leaderboard].sort((a,b) => (b.rankPoints ?? 0) - (a.rankPoints ?? 0)), [leaderboard]);
  const refresh = async () => { if (!onRefresh || refreshing) return; setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } };
  const playerRow = (p: BattleLeaderboardEntry, i: number) => {
    const mine = Boolean(currentUserId && p.userId === currentUserId);
    const name = p.displayName || p.username || 'Bilimdon';
    return <View key={p.userId} style={[s.row, mine && s.myRow]}>
      <View style={[s.place, i < 3 && { backgroundColor: medalColors[i] + '20' }]}>
        {i < 3 ? <Ionicons name={medals[i]} size={17} color={medalColors[i]} /> : <LocalizedText style={s.placeText}>{i + 1}</LocalizedText>}
      </View>
      <View style={[s.avatar, mine && s.myAvatar]}><LocalizedText style={s.avatarText}>{name.trim().charAt(0).toLocaleUpperCase()}</LocalizedText></View>
      <View style={s.identity}>
        <View style={s.nameLine}><LocalizedText numberOfLines={1} style={[s.name, mine && s.myName]}>{mine ? 'Siz' : name}</LocalizedText>{mine && <View style={s.you}><LocalizedText style={s.youText}>SIZ</LocalizedText></View>}</View>
        <LocalizedText numberOfLines={1} style={s.meta}>{p.rankTier || 'Boshlovchi'} · {p.wins ?? 0} g‘alaba</LocalizedText>
      </View>
      <View style={s.points}><LocalizedText style={s.pointsValue}>{(p.rankPoints ?? 0).toLocaleString('uz-UZ')}</LocalizedText><LocalizedText style={s.pointsLabel}>RP</LocalizedText></View>
    </View>;
  };
  return <View style={s.root}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}>
      <View style={s.header}>
        <View style={s.headerIcon}><Ionicons name="trophy" size={23} color={c.primaryLight} /></View>
        <View style={s.headerCopy}>
          <LocalizedText style={s.eyebrow}>QUIZ ARENA  /  NATIJALAR</LocalizedText>
          <LocalizedText style={s.title}>Reyting</LocalizedText>
          <LocalizedText style={s.subtitle}>Eng kuchli bilimdonlar va ularning natijalari</LocalizedText>
        </View>
      </View>
      <View style={s.summary}>
        <View style={s.summaryIcon}><Ionicons name="podium-outline" size={21} color="#F5C451" /></View>
        <View style={s.summaryCopy}><LocalizedText style={s.summaryTitle}>Battle reytingi</LocalizedText><LocalizedText style={s.summaryText}>O‘rinlar rank ochkolari bo‘yicha belgilanadi</LocalizedText></View>
        <LocalizedText style={s.total}>{users.length}</LocalizedText>
      </View>
      {users.length > 0 && <>
        <View style={s.section}><LocalizedText style={s.sectionTitle}>TOP 3 BILIMDON</LocalizedText><LocalizedText style={s.sectionMeta}>Peshqadamlar</LocalizedText></View>
        <View style={s.topThree}>{users.slice(0,3).map((p,i) => {
          const name = p.displayName || p.username || 'Bilimdon';
          return <View key={p.userId} style={[s.topCard, i === 0 && s.topFirst]}>
            <Ionicons name={medals[i]} size={22} color={medalColors[i]} />
            <View style={[s.topAvatar,{borderColor:medalColors[i]}]}><LocalizedText style={s.topAvatarText}>{name.trim().charAt(0).toLocaleUpperCase()}</LocalizedText></View>
            <LocalizedText numberOfLines={1} style={s.topName}>{name}</LocalizedText>
            <LocalizedText style={s.topPoints}>{(p.rankPoints ?? 0).toLocaleString('uz-UZ')} RP</LocalizedText>
            <LocalizedText style={[s.topPlace,{color:medalColors[i]}]}>{i+1}-O‘RIN</LocalizedText>
          </View>;
        })}</View>
      </>}
      <View style={s.section}><LocalizedText style={s.sectionTitle}>TO‘LIQ REYTING</LocalizedText><LocalizedText style={s.sectionMeta}>{users.length} ishtirokchi</LocalizedText></View>
      {loading && users.length === 0 ? <View style={s.state}><ActivityIndicator color={c.primary} size="large" /><LocalizedText style={s.stateText}>Reyting yuklanmoqda...</LocalizedText></View>
      : error ? <View style={s.state}><Ionicons name="cloud-offline-outline" size={26} color={c.textMuted} /><LocalizedText style={s.stateText}>{error}</LocalizedText></View>
      : users.length === 0 ? <View style={s.state}><Ionicons name="trophy-outline" size={28} color={c.textMuted} /><LocalizedText style={s.stateText}>Hozircha reytingda ishtirokchilar yo‘q. Birinchi bo‘lib Battle o‘ynang!</LocalizedText></View>
      : <View style={s.list}>{users.map(playerRow)}</View>}
      <View style={s.footer}><Ionicons name="information-circle-outline" size={16} color={c.textMuted} /><LocalizedText style={s.footerText}>Natijalar serverdagi Battle reytingidan olinadi. Pastga tortib yangilashingiz mumkin.</LocalizedText></View>
    </ScrollView>
  </View>;
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors']) {
 return StyleSheet.create({
  root:{flex:1,width:'100%',backgroundColor:c.background},scroll:{flex:1,width:'100%'},
  content:{width:'100%',paddingHorizontal:20,paddingTop:18,paddingBottom:142},
  header:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20},headerIcon:{width:54,height:54,borderRadius:16,backgroundColor:'rgba(88,101,242,0.15)',alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,minWidth:0},
  eyebrow:{color:c.primary,fontSize:10,fontWeight:'900',letterSpacing:1.6,marginBottom:5},title:{color:c.text,fontSize:29,lineHeight:35,fontWeight:'900',letterSpacing:-.7},subtitle:{color:c.textMuted,fontSize:12,lineHeight:18,marginTop:3},
  summary:{width:'100%',minHeight:78,borderRadius:14,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder},summaryIcon:{width:42,height:42,borderRadius:12,backgroundColor:'rgba(245,196,81,0.12)',alignItems:'center',justifyContent:'center'},summaryCopy:{flex:1,minWidth:0},summaryTitle:{color:c.text,fontSize:14,fontWeight:'900'},summaryText:{color:c.textMuted,fontSize:10,lineHeight:15,marginTop:4},total:{color:c.text,fontSize:21,fontWeight:'900'},
  section:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:25,marginBottom:12},sectionTitle:{color:c.textMuted,fontSize:10,fontWeight:'900',letterSpacing:1.1},sectionMeta:{color:c.textMuted,fontSize:10,fontWeight:'700'},
  topThree:{width:'100%',flexDirection:'row',gap:9,alignItems:'stretch'},topCard:{flex:1,minWidth:0,minHeight:154,borderRadius:14,paddingHorizontal:7,paddingVertical:13,alignItems:'center',justifyContent:'center',backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder},topFirst:{borderColor:'rgba(245,196,81,0.58)',backgroundColor:c.surfaceElevated},topAvatar:{width:43,height:43,borderRadius:22,borderWidth:2,backgroundColor:c.surfaceElevated,alignItems:'center',justifyContent:'center',marginTop:8},topAvatarText:{color:c.text,fontSize:17,fontWeight:'900'},topName:{color:c.text,fontSize:11,fontWeight:'800',marginTop:8,maxWidth:'100%'},topPoints:{color:c.text,fontSize:11,fontWeight:'900',marginTop:4},topPlace:{fontSize:9,fontWeight:'900',letterSpacing:.8,marginTop:5},
  list:{width:'100%',gap:9},row:{width:'100%',minHeight:82,borderRadius:13,paddingHorizontal:13,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:11,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder},myRow:{borderColor:c.primary,backgroundColor:c.surfaceElevated},place:{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:c.surfaceElevated},placeText:{color:c.textMuted,fontSize:11,fontWeight:'900'},avatar:{width:43,height:43,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(88,101,242,0.18)'},myAvatar:{backgroundColor:'rgba(139,92,246,0.30)'},avatarText:{color:c.primaryLight,fontSize:17,fontWeight:'900'},identity:{flex:1,minWidth:0},nameLine:{flexDirection:'row',alignItems:'center',gap:6},name:{color:c.text,fontSize:13,fontWeight:'900',flexShrink:1},myName:{color:c.primaryLight},you:{backgroundColor:c.primary,borderRadius:5,paddingHorizontal:5,paddingVertical:2},youText:{color:'#FFFFFF',fontSize:8,fontWeight:'900'},meta:{color:c.textMuted,fontSize:10,marginTop:5},points:{alignItems:'flex-end',minWidth:54},pointsValue:{color:c.text,fontSize:15,fontWeight:'900'},pointsLabel:{color:c.textMuted,fontSize:9,fontWeight:'800',marginTop:2},
  state:{width:'100%',minHeight:150,borderRadius:14,padding:20,alignItems:'center',justifyContent:'center',gap:12,backgroundColor:c.surface,borderWidth:1,borderColor:c.glassBorder},stateText:{color:c.textMuted,fontSize:12,lineHeight:18,textAlign:'center'},footer:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:18,paddingHorizontal:2},footerText:{color:c.textMuted,fontSize:10,lineHeight:15,flex:1},
 });
}
