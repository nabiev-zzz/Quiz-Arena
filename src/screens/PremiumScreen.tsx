import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import type { Purchase } from 'expo-iap';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { createPremiumCheckout, getGooglePlayAccountId, getPremiumPlans, getPremiumStatus, verifyGooglePlayPurchase, type PremiumPlan, type PremiumStatus } from '../services/subscriptionService';

interface Props { onBack?: () => void }
const money = (value: number | null) => value === null ? 'Narx sozlanmagan' : new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m';
const planBenefits = (planKey: string): string[] => {
  if (planKey.startsWith('legenda_plus_')) return [
    'Cheksiz kengaytirilgan PDF hisobotlar',
    'Oyiga 100 ta hujjatdan 100 tagacha savol · 15 MB gacha',
    'Kuniga 30 ta do‘stlar Battle, elita turnirlar va Legend maqomi',
    'Cheksiz AI Ustoz va shaxsiy rivojlanish rejasi',
    'Noyob bezaklar va animatsiyali oltin ramka',
  ];
  if (planKey.startsWith('premium_pro_')) return [
    'Cheksiz kengaytirilgan PDF hisobotlar',
    'Oyiga 30 ta hujjatdan 50 tagacha savol · 12 MB gacha',
    'Kuniga 20 ta xususiy Friends Battle',
    'AI Ustoz, xatolar tahlili va to‘liq tarix',
    'Cheksiz AI Smart Practice va maxsus turnirlar',
  ];
  return [
    'Oyiga 10 ta kengaytirilgan PDF hisobot',
    'Oyiga 5 ta hujjatdan 25 tagacha savol · 8 MB gacha',
    'Kuniga 10 ta xususiy Friends Battle (1 ga 1)',
    'Premium profil nishoni va eksklyuziv bezaklar',
    'Kengaytirilgan statistika va maxsus Battle sozlamalari',
  ];
};
const GOOGLE_PLAY_SKUS: Record<string, string | undefined> = {
  premium_monthly: process.env.EXPO_PUBLIC_GOOGLE_PLAY_MONTHLY_PRODUCT_ID?.trim(),
  premium_yearly: process.env.EXPO_PUBLIC_GOOGLE_PLAY_YEARLY_PRODUCT_ID?.trim(),
  premium_pro_monthly: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PREMIUM_PRO_MONTHLY_PRODUCT_ID?.trim(),
  premium_pro_yearly: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PREMIUM_PRO_YEARLY_PRODUCT_ID?.trim(),
  legenda_plus_monthly: process.env.EXPO_PUBLIC_GOOGLE_PLAY_LEGENDA_PLUS_MONTHLY_PRODUCT_ID?.trim(),
  legenda_plus_yearly: process.env.EXPO_PUBLIC_GOOGLE_PLAY_LEGENDA_PLUS_YEARLY_PRODUCT_ID?.trim(),
};

export default function PremiumScreen({ onBack }: Props) {
  const { tokens, isDark } = useTheme();
  // Only mount expo-iap inside a native Android build. Expo Go does not include ExpoIap.
  // Use an allow-list so unknown/store-client environments fail closed instead of crashing.
  const canUseGooglePlayBilling = Platform.OS === 'android' && (
    Constants.executionEnvironment === 'bare' ||
    Constants.executionEnvironment === 'standalone'
  );
  const isExpoGo = Platform.OS === 'android' && !canUseGooglePlayBilling;
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
  useEffect(() => { void load(); }, [load]);

  const startCheckout = async (provider: 'click' | 'payme', planKey: string) => {
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
        {status?.isPremium ? <LocalizedText style={s.active}>{status.tier.replace('_', ' ').toUpperCase()} FAOL · {status.subscription?.expiresAt ? new Date(status.subscription.expiresAt).toLocaleDateString('uz-UZ') + ' gacha' : ''}</LocalizedText> : <LocalizedText style={s.inactive}>Hozirgi tarif: FREE</LocalizedText>}
        <Pressable onPress={() => void load()} style={s.refresh}><Ionicons name="refresh" size={15} color="#E8E0FF" /><LocalizedText style={s.refreshText}>Obuna holatini yangilash</LocalizedText></Pressable>
      </GlassSurface>
      <LocalizedText style={[s.section, { color: c.text }]}>Obuna tariflari</LocalizedText>
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} /> : error ? <GlassSurface intensity={30} style={s.notice}><LocalizedText style={[s.noticeText, { color: c.text }]}>{error}</LocalizedText><Pressable onPress={() => void load()}><LocalizedText style={s.retry}>Qayta urinish</LocalizedText></Pressable></GlassSurface> : plans.map((plan, index) => (
        <GlassSurface key={plan.key} intensity={isDark ? 34 : 42} style={[s.plan, index === 1 && s.featured]}>
          <View style={s.planTop}><View><LocalizedText style={[s.planName, { color: c.text }]}>{plan.name} {plan.durationDays === 365 ? 'Yillik' : 'Oylik'}</LocalizedText><LocalizedText style={[s.planDuration, { color: c.textMuted }]}>{plan.durationDays} kunlik obuna</LocalizedText>{plan.durationDays === 365 && plan.price !== null ? (() => { const monthlyPlan = plans.find((item) => item.key === plan.key.replace(/_yearly$/, '_monthly')); if (!monthlyPlan?.price) return null; const saving = Math.round((1 - plan.price / (monthlyPlan.price * 12)) * 100); return <LocalizedText style={[s.planDuration, { color: '#70D7B4' }]}>Oyiga taxminan {money(Math.round(plan.price / 12))} · {saving}% chegirma</LocalizedText>; })() : null}</View><LocalizedText style={s.price}>{money(plan.price)}</LocalizedText></View>
          {planBenefits(plan.key).map((benefit) => <View key={benefit} style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><LocalizedText style={[s.benefitText, { color: c.text }]}>{benefit}</LocalizedText></View>)}
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
      {canUseGooglePlayBilling ? (
        <GooglePlayPurchaseControls plans={plans} busy={busy} setBusy={setBusy} load={load} />
      ) : null}
      <LocalizedText style={[s.section, { color: c.text }]}>Google Play</LocalizedText>
      <GlassSurface intensity={isDark ? 30 : 38} style={s.googleNotice}>
        <Ionicons name="logo-google-playstore" size={23} color={c.text} />
        <View style={{ flex: 1 }}>
          <LocalizedText style={{ color: c.text, fontWeight: '800' }}>Google Play obunasi</LocalizedText>
          <LocalizedText style={{ color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{isExpoGo ? 'Expo Go Google Play Billing native modulini qo‘llab-quvvatlamaydi. Ilovani Android development build orqali ochganda xaridlar ishlaydi.' : 'Google Play Billing va Play Console mahsulot ID’lari sozlangan Android build orqali obuna xarid qilishingiz mumkin.'}</LocalizedText>
        </View>
      </GlassSurface>
      <LocalizedText style={[s.footnote,{color:c.textMuted}]}>Premium faqat Click, Payme yoki Google Play serveri to‘lovni tasdiqlagandan keyin faollashadi. To‘lov oynasidan qaytgach, obuna holatini yangilang.</LocalizedText>
    </ScrollView>
  );
}

interface GooglePlayPurchaseControlsProps {
  plans: PremiumPlan[];
  busy: string | null;
  setBusy: (value: string | null) => void;
  load: () => Promise<void>;
}

function GooglePlayPurchaseControls({ plans, busy, setBusy, load }: GooglePlayPurchaseControlsProps) {
  const { useIAP: useIAPHook } = require('expo-iap') as typeof import('expo-iap');
  const purchaseHandlerRef = useRef<((purchase: Purchase) => Promise<void>) | null>(null);
  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAPHook({
    onPurchaseSuccess: (purchase) => {
      const task = purchaseHandlerRef.current?.(purchase);
      if (task) void task.catch((e) => {
        setBusy(null);
        showLocalizedAlert('Xaridni tasdiqlashda xatolik', e instanceof Error ? e.message : 'Keyinroq qayta urinib ko‘ring');
      });
    },
    onPurchaseError: (purchaseError) => {
      setBusy(null);
      showLocalizedAlert('Google Play xaridi', purchaseError.message || 'Xarid amalga oshmadi');
    },
  });

  purchaseHandlerRef.current = async (purchase) => {
    if (!purchase.purchaseToken) throw new Error('Google Play purchase token topilmadi');
    await verifyGooglePlayPurchase(purchase.purchaseToken);
    try { await finishTransaction({ purchase, isConsumable: false }); } catch { /* Backend has already verified and acknowledged the subscription. */ }
    setBusy(null);
    await load();
    showLocalizedAlert('Premium faollashtirildi', 'Google Play obunangiz serverda tasdiqlandi.');
  };

  useEffect(() => {
    if (!connected) return;
    const skus = Object.values(GOOGLE_PLAY_SKUS).filter((sku): sku is string => Boolean(sku));
    if (skus.length) void fetchProducts({ skus, type: 'subs' }).catch(() => {
      // Store products may be unavailable until the Play Console products are activated.
    });
  }, [connected, fetchProducts]);

  const startGooglePlayPurchase = async (planKey: string) => {
    const sku = GOOGLE_PLAY_SKUS[planKey];
    if (!sku || !connected) {
      showLocalizedAlert('Google Play tayyor emas', 'Play Console mahsulot ID’lari va Android development build sozlanishi kerak.');
      return;
    }
    const product = subscriptions.find((item) => item.id === sku);
    const offerToken = product?.subscriptionOffers?.find((offer) => Boolean(offer.offerTokenAndroid))?.offerTokenAndroid;
    if (!offerToken) {
      showLocalizedAlert('Obuna topilmadi', 'Google Play Console’da ushbu tarif uchun faol base plan va offer yarating.');
      return;
    }
    setBusy('google:' + planKey);
    try {
      const obfuscatedAccountId = await getGooglePlayAccountId();
      await requestPurchase({
        request: { google: { skus: [sku], subscriptionOffers: [{ sku, offerToken }], obfuscatedAccountId } },
        type: 'subs',
      });
    } catch (e) {
      setBusy(null);
      showLocalizedAlert('Google Play xaridi', e instanceof Error ? e.message : 'Xaridni boshlash imkoni bo‘lmadi');
    }
  };

  return (
    <>
      {plans.filter((plan) => Boolean(GOOGLE_PLAY_SKUS[plan.key])).map((plan) => (
        <Pressable key={plan.key} disabled={!connected || busy !== null} onPress={() => void startGooglePlayPurchase(plan.key)} style={[s.googleButton, (!connected || busy !== null) && s.dim]}>
          {busy === 'google:' + plan.key ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="logo-google-playstore" size={17} color="#FFFFFF" /><LocalizedText style={s.checkoutText}>Google Play · {plan.name}</LocalizedText></>}
        </Pressable>
      ))}
    </>
  );
}

const s=StyleSheet.create({
 content:{padding:20,paddingBottom:132,gap:17},header:{flexDirection:'row',alignItems:'center',gap:14},back:{width:44,height:44,borderRadius:15,alignItems:'center',justifyContent:'center'},heading:{fontSize:21,fontWeight:'900'},
 hero:{padding:22,borderRadius:26,backgroundColor:'rgba(111,83,206,0.20)',borderColor:'rgba(194,170,255,0.32)',borderWidth:1,gap:10},heroTitle:{fontSize:23,fontWeight:'900',color:'#F4F0FF'},heroText:{fontSize:14,lineHeight:21,color:'#D1C7F3'},active:{fontSize:12,fontWeight:'900',color:'#6DE0B8'},inactive:{fontSize:12,fontWeight:'800',color:'#D8C6FF'},refresh:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingTop:4},refreshText:{fontSize:12,fontWeight:'800',color:'#E8E0FF'},
 section:{fontSize:18,fontWeight:'900',marginTop:5},plan:{padding:18,borderRadius:22,gap:13,borderWidth:1,borderColor:'rgba(160,145,210,0.26)'},featured:{borderColor:'rgba(239,199,111,0.55)',backgroundColor:'rgba(130,95,200,0.16)'},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},planName:{fontSize:17,fontWeight:'900'},planDuration:{fontSize:12,marginTop:4},price:{fontSize:15,fontWeight:'900',color:'#EFCB78',textAlign:'right'},benefit:{flexDirection:'row',alignItems:'center',gap:8},benefitText:{fontSize:12,flex:1},checkoutRow:{flexDirection:'row',gap:10,marginTop:3},googleButton:{minHeight:48,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#477B4A'},checkoutButton:{flex:1,minHeight:48,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},clickButton:{backgroundColor:'#2878D0'},paymeButton:{backgroundColor:'#21A89A'},checkoutText:{fontSize:14,fontWeight:'900',color:'#FFFFFF'},dim:{opacity:0.45},googleNotice:{padding:16,borderRadius:18,flexDirection:'row',alignItems:'center',gap:12},footnote:{fontSize:11,lineHeight:17},notice:{padding:18,gap:10},noticeText:{fontSize:13},retry:{color:'#A995FF',fontWeight:'800'}
});
