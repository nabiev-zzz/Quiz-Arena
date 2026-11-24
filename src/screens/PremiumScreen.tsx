import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIAP, type Purchase } from 'expo-iap';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { createPremiumCheckout, getGooglePlayAccountId, getPremiumPlans, getPremiumStatus, verifyGooglePlayPurchase, type PremiumPlan, type PremiumStatus } from '../services/subscriptionService';

interface Props { onBack?: () => void }
const money = (value: number | null) => value === null ? 'Narx sozlanmagan' : new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m';
const GOOGLE_MONTHLY_SKU = process.env.EXPO_PUBLIC_GOOGLE_PLAY_MONTHLY_PRODUCT_ID?.trim();
const GOOGLE_YEARLY_SKU = process.env.EXPO_PUBLIC_GOOGLE_PLAY_YEARLY_PRODUCT_ID?.trim();

export default function PremiumScreen({ onBack }: Props) {
  const { tokens, isDark } = useTheme();
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

  const purchaseHandlerRef = useRef<((purchase: Purchase) => Promise<void>) | null>(null);
  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => {
      const task = purchaseHandlerRef.current?.(purchase);
      if (task) void task.catch((e) => {
        setBusy(null);
        Alert.alert('Xaridni tasdiqlashda xatolik', e instanceof Error ? e.message : 'Keyinroq qayta urinib ko‘ring');
      });
    },
    onPurchaseError: (purchaseError) => {
      setBusy(null);
      Alert.alert('Google Play xaridi', purchaseError.message || 'Xarid amalga oshmadi');
    },
  });

  purchaseHandlerRef.current = async (purchase) => {
    if (!purchase.purchaseToken) throw new Error('Google Play purchase token topilmadi');
    await verifyGooglePlayPurchase(purchase.purchaseToken);
    try { await finishTransaction({ purchase, isConsumable: false }); } catch { /* Backend has already verified and acknowledged the subscription. */ }
    setBusy(null);
    await load();
    Alert.alert('Premium faollashtirildi', 'Google Play obunangiz serverda tasdiqlandi.');
  };

  useEffect(() => {
    if (!connected) return;
    const skus = [GOOGLE_MONTHLY_SKU, GOOGLE_YEARLY_SKU].filter((sku): sku is string => Boolean(sku));
    if (skus.length) void fetchProducts({ skus, type: 'subs' }).catch(() => {
      // Store products may be unavailable until the Play Console products are activated.
    });
  }, [connected, fetchProducts]);

  const startGooglePlayPurchase = async (planKey: string) => {
    const sku = planKey === 'premium_monthly' ? GOOGLE_MONTHLY_SKU : GOOGLE_YEARLY_SKU;
    if (!sku || !connected) {
      Alert.alert('Google Play tayyor emas', 'Play Console mahsulot ID’lari va Android development build sozlanishi kerak.');
      return;
    }
    const product = subscriptions.find((item) => item.id === sku);
    const offerToken = product?.subscriptionOffers?.find((offer) => Boolean(offer.offerTokenAndroid))?.offerTokenAndroid;
    if (!offerToken) {
      Alert.alert('Obuna topilmadi', 'Google Play Console’da ushbu tarif uchun faol base plan va offer yarating.');
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
      Alert.alert('Google Play xaridi', e instanceof Error ? e.message : 'Xaridni boshlash imkoni bo‘lmadi');
    }
  };

  const startCheckout = async (provider: 'click' | 'payme', planKey: string) => {
    const key = provider + ':' + planKey;
    setBusy(key);
    try {
      const checkout = await createPremiumCheckout(provider, planKey);
      if (!checkout.checkoutUrl) throw new Error('To‘lov sahifasi hali sozlanmagan');
      await Linking.openURL(checkout.checkoutUrl);
    } catch (e) {
      Alert.alert('To‘lovni boshlash imkoni bo‘lmadi', e instanceof Error ? e.message : 'Keyinroq qayta urinib ko‘ring');
    } finally { setBusy(null); }
  };

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
        <Pressable onPress={() => void load()} style={s.refresh}><Ionicons name="refresh" size={15} color="#E8E0FF" /><Text style={s.refreshText}>Obuna holatini yangilash</Text></Pressable>
      </GlassSurface>
      <Text style={[s.section, { color: c.text }]}>Obuna tariflari</Text>
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} /> : error ? <GlassSurface intensity={30} style={s.notice}><Text style={[s.noticeText, { color: c.text }]}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.retry}>Qayta urinish</Text></Pressable></GlassSurface> : plans.map((plan, index) => (
        <GlassSurface key={plan.key} intensity={isDark ? 34 : 42} style={[s.plan, index === 1 && s.featured]}>
          <View style={s.planTop}><View><Text style={[s.planName, { color: c.text }]}>{plan.name} {plan.durationDays === 365 ? 'Yillik' : 'Oylik'}</Text><Text style={[s.planDuration, { color: c.textMuted }]}>{plan.durationDays} kunlik obuna</Text></View><Text style={s.price}>{money(plan.price)}</Text></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><Text style={[s.benefitText, { color: c.text }]}>Eksklyuziv profil bezaklari va Premium nishoni</Text></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><Text style={[s.benefitText, { color: c.text }]}>Kengaytirilgan statistika va maxsus imkoniyatlar</Text></View>
          <View style={s.benefit}><Ionicons name="checkmark-circle" size={17} color="#70D7B4" /><Text style={[s.benefitText, { color: c.text }]}>Yangi Premium funksiyalari qo‘shilganda foydalanish</Text></View>
          <View style={s.checkoutRow}>
            <Pressable disabled={!plan.available || busy !== null} onPress={() => void startCheckout('click', plan.key)} style={[s.checkoutButton, s.clickButton, (!plan.available || busy !== null) && s.dim]}>
              {busy === 'click:' + plan.key ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="card" size={17} color="#FFFFFF" /><Text style={s.checkoutText}>Click</Text></>}
            </Pressable>
            <Pressable disabled={!plan.available || busy !== null} onPress={() => void startCheckout('payme', plan.key)} style={[s.checkoutButton, s.paymeButton, (!plan.available || busy !== null) && s.dim]}>
              {busy === 'payme:' + plan.key ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="wallet" size={17} color="#FFFFFF" /><Text style={s.checkoutText}>Payme</Text></>}
            </Pressable>
          </View>
          {Platform.OS === 'android' && (plan.key === 'premium_monthly' ? GOOGLE_MONTHLY_SKU : GOOGLE_YEARLY_SKU) ? (
            <Pressable disabled={!connected || busy !== null} onPress={() => void startGooglePlayPurchase(plan.key)} style={[s.googleButton, (!connected || busy !== null) && s.dim]}>
              {busy === 'google:' + plan.key ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="logo-google-playstore" size={17} color="#FFFFFF" /><Text style={s.checkoutText}>Google Play orqali obuna</Text></>}
            </Pressable>
          ) : null}
          {!plan.available && <Text style={[s.planDuration, { color: c.textMuted }]}>Tarif narxi serverda sozlanmagan.</Text>}
        </GlassSurface>
      ))}
      <Text style={[s.section, { color: c.text }]}>Google Play</Text>
      <GlassSurface intensity={isDark ? 30 : 38} style={s.googleNotice}>
        <Ionicons name="logo-google-playstore" size={23} color={c.text} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '800' }}>Google Play obunasi</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>Android Billing moduli va Play Console mahsulot ID’lari ulanayotganidan keyin xarid tugmasi faollashadi.</Text>
        </View>
      </GlassSurface>
      <Text style={[s.footnote,{color:c.textMuted}]}>Premium faqat Click, Payme yoki Google Play serveri to‘lovni tasdiqlagandan keyin faollashadi. To‘lov oynasidan qaytgach, obuna holatini yangilang.</Text>
    </ScrollView>
  );
}
const s=StyleSheet.create({
 content:{padding:20,paddingBottom:130,gap:16},header:{flexDirection:'row',alignItems:'center',gap:14},back:{width:42,height:42,borderRadius:15,alignItems:'center',justifyContent:'center'},heading:{fontSize:21,fontWeight:'900'},
 hero:{padding:22,borderRadius:25,backgroundColor:'rgba(111,83,206,0.22)',borderColor:'rgba(194,170,255,0.3)',gap:10},heroTitle:{fontSize:23,fontWeight:'900',color:'#F4F0FF'},heroText:{fontSize:14,lineHeight:21,color:'#D1C7F3'},active:{fontSize:12,fontWeight:'900',color:'#6DE0B8'},inactive:{fontSize:12,fontWeight:'800',color:'#D8C6FF'},refresh:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingTop:4},refreshText:{fontSize:12,fontWeight:'800',color:'#E8E0FF'},
 section:{fontSize:18,fontWeight:'900',marginTop:5},plan:{padding:18,borderRadius:22,gap:13,borderWidth:1,borderColor:'rgba(160,145,210,0.22)'},featured:{borderColor:'rgba(239,199,111,0.55)',backgroundColor:'rgba(130,95,200,0.16)'},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},planName:{fontSize:17,fontWeight:'900'},planDuration:{fontSize:12,marginTop:4},price:{fontSize:15,fontWeight:'900',color:'#EFCB78',textAlign:'right'},benefit:{flexDirection:'row',alignItems:'center',gap:8},benefitText:{fontSize:12,flex:1},checkoutRow:{flexDirection:'row',gap:10,marginTop:3},googleButton:{minHeight:44,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#477B4A'},checkoutButton:{flex:1,minHeight:45,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},clickButton:{backgroundColor:'#2878D0'},paymeButton:{backgroundColor:'#21A89A'},checkoutText:{fontSize:14,fontWeight:'900',color:'#FFFFFF'},dim:{opacity:0.45},googleNotice:{padding:16,borderRadius:18,flexDirection:'row',alignItems:'center',gap:12},footnote:{fontSize:11,lineHeight:17},notice:{padding:18,gap:10},noticeText:{fontSize:13},retry:{color:'#A995FF',fontWeight:'800'}
});
