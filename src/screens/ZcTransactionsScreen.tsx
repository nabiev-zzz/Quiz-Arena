import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../i18n/LocalizedText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getZcHistory, type ZcTransactionItem } from '../services/zcWalletService';

export default function ZcTransactionsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { tokens } = useTheme();
  const c = tokens.colors;
  const [items, setItems] = useState<ZcTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { const result = await getZcHistory(100); setItems(result.items); }
    catch (e) { setError(e instanceof Error ? e.message : 'Tranzaksiyalar yuklanmadi'); }
    finally { setLoading(false); }
  }, [user?.id, refresh]);
  useEffect(() => { void load(); }, [load]);
  const balance = Math.max(0, Number(user?.zcBalance ?? 0));
  return <View style={s.screen}>
    <View style={[s.header,{borderBottomColor:c.border}]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Orqaga" style={[s.back,{backgroundColor:c.surface}]}><Ionicons name="arrow-back" size={21} color={c.text}/></Pressable>
      <View style={{flex:1}}><LocalizedText style={[s.eyebrow,{color:c.textMuted}]}>ZELQEN CREDITS</LocalizedText><LocalizedText style={[s.title,{color:c.text}]}>Tranzaksiyalar</LocalizedText></View>
      <Pressable onPress={()=>setRefresh(x=>x+1)} accessibilityRole="button" accessibilityLabel="Yangilash" style={[s.back,{backgroundColor:c.surface}]}><Ionicons name="refresh" size={19} color={c.text}/></Pressable>
    </View>
    <View style={[s.balance,{backgroundColor:c.surface,borderColor:c.border}]}>
      <View style={s.balanceIcon}><Ionicons name="wallet" size={22} color="#E7C56D"/></View>
      <View style={{flex:1}}><LocalizedText style={[s.balanceLabel,{color:c.textMuted}]}>Joriy balans</LocalizedText><NativeText style={s.balanceValue}>{balance.toLocaleString('en-US')} ZC</NativeText></View>
    </View>
    <View style={s.sectionHead}><LocalizedText style={[s.sectionTitle,{color:c.text}]}>Barcha operatsiyalar</LocalizedText><LocalizedText style={[s.count,{color:c.textMuted}]}>{items.length} ta</LocalizedText></View>
    {loading ? <ActivityIndicator color={c.primary} style={{marginTop:35}}/> : error ? <View style={[s.empty,{backgroundColor:c.surface,borderColor:c.border}]}><Ionicons name="cloud-offline-outline" size={30} color={c.textMuted}/><LocalizedText style={[s.emptyText,{color:c.textMuted}]}>{error}</LocalizedText><Pressable onPress={()=>setRefresh(x=>x+1)} style={[s.retry,{backgroundColor:c.primary}]}><LocalizedText style={s.retryText}>Qayta urinish</LocalizedText></Pressable></View> : items.length===0 ? <View style={[s.empty,{backgroundColor:c.surface,borderColor:c.border}]}><Ionicons name="receipt-outline" size={34} color={c.textMuted}/><LocalizedText style={[s.emptyTitle,{color:c.text}]}>Hali tranzaksiya yo‘q</LocalizedText><LocalizedText style={[s.emptyText,{color:c.textMuted}]}>ZC olganingiz yoki sarflaganingizda operatsiyalar shu yerda ko‘rinadi.</LocalizedText></View> :
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>{items.map(item=><View key={item.id} style={[s.item,{backgroundColor:c.surface,borderColor:c.border}]}>
        <View style={[s.icon,{backgroundColor:item.type==='credit'?'rgba(53,201,149,0.13)':'rgba(226,140,155,0.13)'}]}><Ionicons name={item.type==='credit'?'arrow-down':'arrow-up'} size={19} color={item.type==='credit'?'#35C995':'#E28C9B'}/></View>
        <View style={{flex:1,minWidth:0}}><LocalizedText style={[s.reason,{color:c.text}]} numberOfLines={2}>{item.reason}</LocalizedText><LocalizedText style={[s.date,{color:c.textMuted}]}>{new Date(item.createdAt).toLocaleString()}</LocalizedText><LocalizedText style={[s.balanceAfter,{color:c.textMuted}]}>Qoldiq: {item.balanceAfter.toLocaleString('en-US')} ZC</LocalizedText></View>
        <NativeText style={{color:item.type==='credit'?'#35C995':'#E28C9B',fontSize:14,fontWeight:'900'}}>{item.type==='credit'?'+':'−'}{item.amount.toLocaleString('en-US')} ZC</NativeText>
      </View>)}</ScrollView>}
  </View>;
}
const s=StyleSheet.create({screen:{flex:1},header:{minHeight:76,paddingHorizontal:19,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1},back:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.5},title:{fontSize:20,fontWeight:'900',marginTop:2},balance:{margin:18,padding:19,borderRadius:23,borderWidth:1,flexDirection:'row',alignItems:'center',gap:12},balanceIcon:{width:48,height:48,borderRadius:15,backgroundColor:'rgba(214,182,106,0.14)',alignItems:'center',justifyContent:'center'},balanceLabel:{fontSize:11},balanceValue:{fontSize:23,fontWeight:'900',color:'#D9B65B',marginTop:3},sectionHead:{paddingHorizontal:17,paddingBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{fontSize:15,fontWeight:'900'},count:{fontSize:11},list:{paddingHorizontal:16,paddingBottom:130,gap:8},item:{borderWidth:1,borderRadius:19,padding:15,flexDirection:'row',alignItems:'center',gap:10},icon:{width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center'},reason:{fontSize:12,fontWeight:'800'},date:{fontSize:10,marginTop:4},balanceAfter:{fontSize:9,marginTop:3},empty:{margin:16,padding:25,borderRadius:18,borderWidth:1,alignItems:'center',gap:9},emptyTitle:{fontSize:15,fontWeight:'900'},emptyText:{fontSize:11,textAlign:'center',lineHeight:17},retry:{paddingHorizontal:16,paddingVertical:11,borderRadius:12},retryText:{color:'#fff',fontSize:12,fontWeight:'900'}});
