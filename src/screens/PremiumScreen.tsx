import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { getPremiumPlans, getPremiumStatus, type PremiumPlan, type PremiumStatus } from '../services/subscriptionService';

interface Props { onBack?: () => void }
const money = (value: number | null) => value === null ? 'Narx sozlanmagan' : new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m';

export default function PremiumScreen({ onBack }: Props) {
  const { tokens, isDark } = useTheme();
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextPlans, nextStatus] = await Promise.all([getPremiumPlans(), getPremiumStatus()]);
      setPlans(nextPlans); setStatus(nextStatus);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ma’lumotlarni yuklab bo‘lmadi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const c = tokens.colors;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={[s.back, { backgroundColor: c.surfaceGlass }]}><Ionicons name="arrow-back" size={21} color={c.text} /></Pressable>
        <Text style={[s.heading, { color: c.text }]}>QUIZ ARENA Premium</Text>
      </View>
      <GlassSurface intensity={isDark ? 42 : 50} style={s.hero}>
        <Ionicons name="diamond" size={34} color="#F3CE75" />
        <Text style={s.heroTitle}>Bilimingga ko‘proq imkoniyat</Text>
        <Text style={s.heroText}>Premium bilan o‘qish, musobaqa va profilingni yangi darajaga olib chiq.</Text>
        {status?.isPremium ? <Text style={s.active}>PREMIUM FAOL · {status.subscription?.expiresAt ? new Date(status.subscription.expiresAt).toLocaleDateString('uz-UZ') + ' gacha' : ''}</Text> : <Text style={s.inactive}>Hozirgi tarif: FREE</Text>}
      </GlassSurface>
      <Text style={[s.section, { color: c.text }]}>Obuna tariflari</Text>
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} /> : error ? <GlassSurface intensity={30} style={s.notice}><Text style={[s.noticeText, { color: c.text }]}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.retry}>Qayta urinish</Text></Pressable></GlassSurface> : plans.map((plan, index) => (
        <GlassSurface key={plan.key} intensity={isDark ? 34 : 42} style={[s.plan, index === 1 && s.featured]}>
          <View style={s.planTop}><View><Text style={[s.planName, { color: c.text }]}>{plan.name} {plan.durationDays === 365 ? 'Yillik' : 'Oylik'}</Text><Text style={[s.planDuration, { color: c.textMuted }]}>{plan.durationDays} kunlik obuna</Text></View><Text style={s.price}>{money(plan.price)}</Text></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><Text style={[s.benefitText, { color: c.text }]}>Eksklyuziv profil bezaklari va Premium nishoni</Text></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><Text style={[s.benefitText, { color: c.text }]}>Kengaytirilgan statistika va maxsus imkoniyatlar</Text></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><Text style={[s.benefitText, { color: c.text }]}>Yangi Premium funksiyalari qo‘shilganda foydalanish</Text></View>
          <View style={[s.disabledButton, { opacity: plan.available ? 1 : 0.55 }]}><Text style={s.disabledText}>{plan.available ? 'To‘lov provayderlari sozlanmoqda' : 'Narx va to‘lov sozlamalari kutilmoqda'}</Text></View>
        </GlassSurface>
      ))}
      <Text style={[s.section, { color: c.text }]}>To‘lov usullari</Text>
      <View style={s.methods}>
        {([{name:'Google Play',icon:'logo-google-playstore'},{name:'Click',icon:'card-outline'},{name:'Payme',icon:'wallet-outline'}] as const).map(m => <View key={m.name} style={[s.method,{backgroundColor:c.surfaceGlass,borderColor:c.glassBorder}]}><Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={20} color={c.text} /><Text style={{color:c.text,fontWeight:'700'}}>{m.name}</Text><Text style={{color:c.textMuted,fontSize:11}}>Ulanish kutilmoqda</Text></View>)}
      </View>
      <Text style={[s.footnote,{color:c.textMuted}]}>Xaridlar faqat provayder tomonidan serverda tasdiqlangandan keyin Premium faollashadi. Hozircha haqiqiy to‘lov qabul qilinmaydi.</Text>
    </ScrollView>
  );
}
const s=StyleSheet.create({
 content:{padding:20,paddingBottom:130,gap:16},header:{flexDirection:'row',alignItems:'center',gap:14},back:{width:42,height:42,borderRadius:15,alignItems:'center',justifyContent:'center'},heading:{fontSize:21,fontWeight:'900'},
 hero:{padding:22,borderRadius:25,backgroundColor:'rgba(111,83,206,0.22)',borderColor:'rgba(194,170,255,0.3)',gap:10},heroTitle:{fontSize:23,fontWeight:'900',color:'#F4F0FF'},heroText:{fontSize:14,lineHeight:21,color:'#D1C7F3'},active:{fontSize:12,fontWeight:'900',color:'#6DE0B8'},inactive:{fontSize:12,fontWeight:'800',color:'#D8C6FF'},
 section:{fontSize:18,fontWeight:'900',marginTop:5},plan:{padding:18,borderRadius:22,gap:13,borderWidth:1,borderColor:'rgba(160,145,210,0.22)'},featured:{borderColor:'rgba(239,199,111,0.55)',backgroundColor:'rgba(130,95,200,0.16)'},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},planName:{fontSize:17,fontWeight:'900'},planDuration:{fontSize:12,marginTop:4},price:{fontSize:15,fontWeight:'900',color:'#EFCB78',textAlign:'right'},benefit:{flexDirection:'row',alignItems:'center',gap:8},benefitText:{fontSize:12,flex:1},disabledButton:{borderRadius:13,padding:13,alignItems:'center',backgroundColor:'rgba(133,105,207,0.35)'},disabledText:{fontWeight:'800',fontSize:12,color:'#E8E0FF'},methods:{flexDirection:'row',gap:8},method:{flex:1,minHeight:88,borderRadius:16,borderWidth:1,alignItems:'center',justifyContent:'center',gap:5,padding:8},footnote:{fontSize:11,lineHeight:17},notice:{padding:18,gap:10},noticeText:{fontSize:13},retry:{color:'#A995FF',fontWeight:'800'}
});
