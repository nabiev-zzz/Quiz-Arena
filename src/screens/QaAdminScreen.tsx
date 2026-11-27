import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { adminGrantAccount, adminRevokeAccount, searchAdminUsers, type AdminTargetUser } from '../services/subscriptionService';

const plans = [{ key: 'none', label: 'Faqat ZC' }, { key: 'premium', label: 'PREMIUM' }, { key: 'premium_pro', label: 'PREMIUM PRO' }, { key: 'legenda_plus', label: 'LEGENDA+' }] as const;
export default function QaAdminScreen({ onBack }: { onBack: () => void }) {
  const { tokens } = useTheme();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminTargetUser[]>([]);
  const [target, setTarget] = useState<AdminTargetUser | null>(null);
  const [zc, setZc] = useState('0');
  const [plan, setPlan] = useState<typeof plans[number]['key']>('premium');
  const [days, setDays] = useState('30');
  const [removeZc, setRemoveZc] = useState('0');
  const [removePremium, setRemovePremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const search = async () => {
    if (query.trim().replace(/^@/, '').length < 2) { setError('Kamida 2 ta username harfi kiriting'); return; }
    setLoading(true); setError(''); setMessage('');
    try { setUsers(await searchAdminUsers(query)); setTarget(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Qidiruv bajarilmadi'); }
    finally { setLoading(false); }
  };
  const grant = async () => {
    if (!target) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await adminGrantAccount({ username: target.username, zcAmount: Number(zc), planKey: plan, durationDays: Number(days) });
      setMessage(`@${result.username} hisobiga ${result.zcGranted.toLocaleString('uz-UZ')} ZC berildi. Yangi balans: ${result.zcBalance.toLocaleString('uz-UZ')} ZC. ${result.planKey !== 'none' ? `Premium muddati: ${result.expiresAt ? new Date(result.expiresAt).toLocaleDateString('uz-UZ') : ''}` : ''}`);
      setTarget({ ...target, zcBalance: result.zcBalance });
    } catch (e) { setError(e instanceof Error ? e.message : 'Grant bajarilmadi'); }
    finally { setLoading(false); }
  };
  const revoke = async () => {
    if (!target) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await adminRevokeAccount({ username: target.username, zcAmount: Number(removeZc), premium: removePremium });
      setMessage(`@${result.username}: ${result.zcRemoved.toLocaleString('uz-UZ')} ZC olib tashlandi. Qoldiq: ${result.zcBalance.toLocaleString('uz-UZ')} ZC. ${result.premiumRevoked ? 'Admin bergan Premium bekor qilindi.' : ''}`);
      setTarget({ ...target, zcBalance: result.zcBalance });
    } catch (e) { setError(e instanceof Error ? e.message : 'Bekor qilish bajarilmadi'); }
    finally { setLoading(false); }
  };
  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => <View style={styles.field}><Text style={[styles.label,{color:tokens.colors.textMuted}]}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType="numeric" placeholder={placeholder} placeholderTextColor={tokens.colors.textMuted} style={[styles.input,{color:tokens.colors.text,borderColor:tokens.colors.glassBorder,backgroundColor:tokens.colors.surface}]} /></View>;
  return <ScrollView style={{flex:1,backgroundColor:'transparent'}} contentContainerStyle={styles.container}>
    <View style={styles.header}><Pressable onPress={onBack} style={[styles.back,{backgroundColor:tokens.colors.surface}]}><Ionicons name="arrow-back" size={21} color={tokens.colors.text}/></Pressable><Text style={[styles.title,{color:tokens.colors.text}]}>Admin boshqaruvi</Text></View>
    <View style={[styles.card,{backgroundColor:tokens.colors.surface,borderColor:tokens.colors.glassBorder}]}>
      <Text style={[styles.heading,{color:tokens.colors.text}]}>Akkauntni topish</Text>
      <TextInput value={query} onChangeText={setQuery} autoCapitalize="none" placeholder="@username yoki ism" placeholderTextColor={tokens.colors.textMuted} style={[styles.input,{color:tokens.colors.text,borderColor:tokens.colors.glassBorder,backgroundColor:tokens.colors.background}]} />
      <Pressable disabled={loading} onPress={() => void search()} style={[styles.primary,{backgroundColor:tokens.colors.primary}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>Qidirish</Text>}</Pressable>
      {users.map(item=><Pressable key={item.id} onPress={()=>setTarget(item)} style={[styles.user,{borderColor:tokens.colors.glassBorder,backgroundColor:target?.id===item.id?'rgba(124,92,240,0.18)':'transparent'}]}><View style={{flex:1}}><Text style={[styles.userName,{color:tokens.colors.text}]}>{item.displayName}</Text><Text style={[styles.label,{color:tokens.colors.textMuted}]}>@{item.username} · {item.zcBalance.toLocaleString('uz-UZ')} ZC</Text></View><Ionicons name={target?.id===item.id?'checkmark-circle':'chevron-forward'} size={20} color={tokens.colors.primary}/></Pressable>)}
    </View>
    {target && <><View style={[styles.card,{backgroundColor:tokens.colors.surface,borderColor:tokens.colors.glassBorder}]}><Text style={[styles.heading,{color:tokens.colors.text}]}>Mukofot berish</Text><Text style={[styles.label,{color:tokens.colors.textMuted}]}>Tanlangan: @{target.username} · Balans {target.zcBalance.toLocaleString('uz-UZ')} ZC</Text>
      {field('Beriladigan ZC miqdori',''+zc,setZc,'Masalan: 50000')}
      <Text style={[styles.label,{color:tokens.colors.textMuted,marginTop:10}]}>Premium turi</Text><View style={styles.wrap}>{plans.map(p=><Pressable key={p.key} onPress={()=>setPlan(p.key)} style={[styles.chip,{borderColor:plan===p.key?tokens.colors.primary:tokens.colors.glassBorder,backgroundColor:plan===p.key?'rgba(124,92,240,0.18)':tokens.colors.background}]}><Text style={[styles.chipText,{color:tokens.colors.text}]}>{p.label}</Text></Pressable>)}</View>
      {plan!=='none' && field('Obuna muddati (kun)',''+days,setDays,'30')}
      <Pressable disabled={loading} onPress={()=>void grant()} style={[styles.primary,{backgroundColor:'#269D78'}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>ZC / Premium berish</Text>}</Pressable>
    </View><View style={[styles.card,{backgroundColor:tokens.colors.surface,borderColor:tokens.colors.glassBorder}]}><Text style={[styles.heading,{color:tokens.colors.text}]}>Huquqni olib tashlash</Text>
      {field('Olib tashlanadigan ZC',''+removeZc,setRemoveZc,'Masalan: 10000')}
      <Pressable onPress={()=>setRemovePremium(!removePremium)} style={styles.toggle}><Ionicons name={removePremium?'checkbox':'square-outline'} size={21} color={tokens.colors.primary}/><Text style={[styles.label,{color:tokens.colors.text}]}>Administrator bergan Premium obunani bekor qilish</Text></Pressable>
      <Pressable disabled={loading} onPress={()=>void revoke()} style={[styles.primary,{backgroundColor:'#C44B59'}]}>{loading?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>Tanlangan huquqlarni olib tashlash</Text>}</Pressable>
    </View></>}
    {!!error && <Text style={styles.error}>{error}</Text>}{!!message && <Text style={styles.success}>{message}</Text>}
    <Text style={[styles.note,{color:tokens.colors.textMuted}]}>Faqat faol administrator ishlata oladi. Berish va olib tashlash tarixi ZC hamyonida saqlanadi. Foydalanuvchiga ilova ichida bildirishnoma yuboriladi. To‘lov orqali olingan obunalar admin orqali bekor qilinmaydi.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({container:{padding:18,paddingBottom:50,gap:13},header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:4},back:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'900'},card:{borderWidth:1,borderRadius:18,padding:16,gap:10},heading:{fontSize:16,fontWeight:'900'},input:{borderWidth:1,borderRadius:12,minHeight:46,paddingHorizontal:13,fontSize:14},primary:{minHeight:46,borderRadius:12,alignItems:'center',justifyContent:'center',paddingHorizontal:14},buttonText:{color:'#fff',fontWeight:'900',fontSize:13},user:{borderWidth:1,borderRadius:12,padding:12,flexDirection:'row',alignItems:'center',gap:8},userName:{fontSize:14,fontWeight:'800'},label:{fontSize:12,lineHeight:18},field:{gap:6},wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderWidth:1,borderRadius:10,paddingHorizontal:11,paddingVertical:9},chipText:{fontSize:11,fontWeight:'800'},toggle:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8},error:{color:'#E05A5A',fontWeight:'800'},success:{color:'#24A879',fontWeight:'800',lineHeight:20},note:{fontSize:11,lineHeight:17}});
