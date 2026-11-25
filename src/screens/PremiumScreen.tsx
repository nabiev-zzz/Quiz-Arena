import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { createPremiumCheckout, getPremiumPlans, getPremiumStatus, type PremiumPlan, type PremiumStatus } from '../services/subscriptionService';

interface Props { onBack?: () => void }
const money = (value: number | null) => value === null ? 'Narx sozlanmagan' : new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m';
export default function PremiumScreen({ onBack }: Props) {
  const { tokens, isDark } = useTheme();
  const isGooglePlayRelease = Constants.expoConfig?.extra?.distributionStore === 'google-play';
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextPlans, nextStatus] = await Promise.all([getPremiumPlans(), getPremiumStatus()]);
      setPlans(nextPlans); setStatus(nextStatus);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ma’lumotlarni yuklab bo‘lmadi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const task = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(task);
  }, [load]);

  const startCheckout = async (provider: 'click' | 'payme', planKey: string) => {
    if (isGooglePlayRelease) return;
    const key = provider + ':' + planKey;
    setBusy(key);
    try {
      const checkout = await createPremiumCheckout(provider, planKey);
      if (!checkout.checkoutUrl) throw new Error('To‘lov sahifasi hali sozlanmagan');
      await Linking.openURL(checkout.checkoutUrl);
    } catch (e) {
      showLocalizedAlert('To‘lovni boshlash imkoni bo‘lmadi', e instanceof Error ? e.message : 'Keyinroq qayta urinib ko‘ring');
    } finally { setBusy(null); }
  };

  const c = tokens.colors;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={[s.back, { backgroundColor: c.surfaceGlass }]}><Ionicons name="arrow-back" size={21} color={c.text} /></Pressable>
        <LocalizedText style={[s.heading, { color: c.text }]}>QUIZ ARENA Premium</LocalizedText>
      </View>
      <GlassSurface intensity={isDark ? 42 : 50} style={s.hero}>
        <Ionicons name="diamond" size={34} color="#F3CE75" />
        <LocalizedText style={s.heroTitle}>Bilimingga ko‘proq imkoniyat</LocalizedText>
        <LocalizedText style={s.heroText}>Premium bilan o‘qish, musobaqa va profilingni yangi darajaga olib chiq.</LocalizedText>
        {status?.isPremium ? <LocalizedText style={s.active}>PREMIUM FAOL · {status.subscription?.expiresAt ? new Date(status.subscription.expiresAt).toLocaleDateString('uz-UZ') + ' gacha' : ''}</LocalizedText> : <LocalizedText style={s.inactive}>Hozirgi tarif: FREE</LocalizedText>}
        <Pressable onPress={() => void load()} style={s.refresh}><Ionicons name="refresh" size={15} color="#E8E0FF" /><LocalizedText style={s.refreshText}>Obuna holatini yangilash</LocalizedText></Pressable>
      </GlassSurface>
      <LocalizedText style={[s.section, { color: c.text }]}>{isGooglePlayRelease ? 'Premium imkoniyati' : 'Obuna tariflari'}</LocalizedText>
      {isGooglePlayRelease ? (
        <GlassSurface intensity={isDark ? 30 : 38} style={s.googleNotice}>
          <Ionicons name="shield-checkmark" size={23} color={c.text} />
          <View style={{ flex: 1 }}>
            <LocalizedText style={{ color: c.text, fontWeight: '800' }}>Premium holati</LocalizedText>
            <LocalizedText style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>Bu versiyada tashqi to‘lov havolalari mavjud emas. Hisobingizdagi Premium holati server orqali ko‘rsatiladi.</LocalizedText>
            <Pressable onPress={() => void load()} style={{ marginTop: 10 }}><LocalizedText style={s.retry}>Holatni yangilash</LocalizedText></Pressable>
          </View>
        </GlassSurface>
      ) : loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} /> : error ? <GlassSurface intensity={30} style={s.notice}><LocalizedText style={[s.noticeText, { color: c.text }]}>{error}</LocalizedText><Pressable onPress={() => void load()}><LocalizedText style={s.retry}>Qayta urinish</LocalizedText></Pressable></GlassSurface> : plans.map((plan, index) => (
        <GlassSurface key={plan.key} intensity={isDark ? 34 : 42} style={[s.plan, index === 1 && s.featured]}>
          <View style={s.planTop}><View><LocalizedText style={[s.planName, { color: c.text }]}>{plan.name} {plan.durationDays === 365 ? 'Yillik' : 'Oylik'}</LocalizedText><LocalizedText style={[s.planDuration, { color: c.textMuted }]}>{plan.durationDays} kunlik obuna</LocalizedText>{plan.durationDays === 365 && plan.price !== null ? (() => { const monthlyPlan = plans.find((item) => item.key === plan.key.replace(/_yearly$/, '_monthly')); if (!monthlyPlan?.price) return null; const saving = Math.round((1 - plan.price / (monthlyPlan.price * 12)) * 100); return <LocalizedText style={[s.planDuration, { color: '#70D7B4' }]}>Oyiga taxminan {money(Math.round(plan.price / 12))} · {saving}% chegirma</LocalizedText>; })() : null}</View><LocalizedText style={s.price}>{money(plan.price)}</LocalizedText></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><LocalizedText style={[s.benefitText, { color: c.text }]}>Eksklyuziv profil bezaklari va Premium nishoni</LocalizedText></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><LocalizedText style={[s.benefitText, { color: c.text }]}>Kengaytirilgan statistika va maxsus imkoniyatlar</LocalizedText></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><LocalizedText style={[s.benefitText, { color: c.text }]}>Yangi Premium funksiyalari qo‘shilganda foydalanish</LocalizedText></View>
          <View style={s.checkoutRow}>
            <Pressable disabled={!plan.available || busy !== null} onPress={() => void startCheckout('click', plan.key)} style={[s.checkoutButton, s.clickButton, (!plan.available || busy !== null) && s.dim]}>
              {busy === 'click:' + plan.key ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="card" size={17} color="#FFFFFF" /><LocalizedText style={s.checkoutText}>Click</LocalizedText></>}
            </Pressable>
            <Pressable disabled={!plan.available || busy !== null} onPress={() => void startCheckout('payme', plan.key)} style={[s.checkoutButton, s.paymeButton, (!plan.available || busy !== null) && s.dim]}>
              {busy === 'payme:' + plan.key ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="wallet" size={17} color="#FFFFFF" /><LocalizedText style={s.checkoutText}>Payme</LocalizedText></>}
            </Pressable>
          </View>
          {!plan.available && <LocalizedText style={[s.planDuration, { color: c.textMuted }]}>Tarif narxi serverda sozlanmagan.</LocalizedText>}
        </GlassSurface>
      ))}
      {!isGooglePlayRelease && <LocalizedText style={[s.footnote,{color:c.textMuted}]}>Premium faqat Click yoki Payme serveri to‘lovni tasdiqlagandan keyin faollashadi. To‘lov oynasidan qaytgach, obuna holatini yangilang.</LocalizedText>}
    </ScrollView>
  );
}

const s=StyleSheet.create({
 content:{padding:20,paddingBottom:132,gap:17},header:{flexDirection:'row',alignItems:'center',gap:14},back:{width:44,height:44,borderRadius:15,alignItems:'center',justifyContent:'center'},heading:{fontSize:21,fontWeight:'900'},
 hero:{padding:22,borderRadius:26,backgroundColor:'rgba(111,83,206,0.20)',borderColor:'rgba(194,170,255,0.32)',borderWidth:1,gap:10},heroTitle:{fontSize:23,fontWeight:'900',color:'#F4F0FF'},heroText:{fontSize:14,lineHeight:21,color:'#D1C7F3'},active:{fontSize:12,fontWeight:'900',color:'#6DE0B8'},inactive:{fontSize:12,fontWeight:'800',color:'#D8C6FF'},refresh:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingTop:4},refreshText:{fontSize:12,fontWeight:'800',color:'#E8E0FF'},
 section:{fontSize:18,fontWeight:'900',marginTop:5},plan:{padding:18,borderRadius:22,gap:13,borderWidth:1,borderColor:'rgba(160,145,210,0.26)'},featured:{borderColor:'rgba(239,199,111,0.55)',backgroundColor:'rgba(130,95,200,0.16)'},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},planName:{fontSize:17,fontWeight:'900'},planDuration:{fontSize:12,marginTop:4},price:{fontSize:15,fontWeight:'900',color:'#EFCB78',textAlign:'right'},benefit:{flexDirection:'row',alignItems:'center',gap:8},benefitText:{fontSize:12,flex:1},checkoutRow:{flexDirection:'row',gap:10,marginTop:3},googleButton:{minHeight:48,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#477B4A'},checkoutButton:{flex:1,minHeight:48,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},clickButton:{backgroundColor:'#2878D0'},paymeButton:{backgroundColor:'#21A89A'},checkoutText:{fontSize:14,fontWeight:'900',color:'#FFFFFF'},dim:{opacity:0.45},googleNotice:{padding:16,borderRadius:18,flexDirection:'row',alignItems:'center',gap:12},footnote:{fontSize:11,lineHeight:17},notice:{padding:18,gap:10},noticeText:{fontSize:13},retry:{color:'#A995FF',fontWeight:'800'}
});
