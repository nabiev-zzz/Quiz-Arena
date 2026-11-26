import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BookWingsAvatar from '../components/BookWingsAvatar';
import LaurelWreathAvatar from '../components/LaurelWreathAvatar';
import AnimatedBadge from '../components/AnimatedBadge';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getZcStoreCatalog, purchaseZcStoreItem, type ZcStoreProduct } from '../services/zcStoreService';

type ShopFilter = 'all' | 'frames' | 'effects' | 'badges' | 'decorations' | 'avatars';

const FILTERS: { id: ShopFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'Barchasi', icon: 'grid-outline' },
  { id: 'frames', label: 'Ramkalar', icon: 'ellipse-outline' },
  { id: 'effects', label: '3D effektlar', icon: 'sparkles-outline' },
  { id: 'badges', label: 'Nishonlar', icon: 'medal-outline' },
  { id: 'decorations', label: 'Bezaklar', icon: 'ribbon-outline' },
  { id: 'avatars', label: 'Jonli avatarlar', icon: 'book-outline' },
];

interface Props { onBack: () => void; }

export default function ShopScreen({ onBack }: Props) {
  const { user, refreshUser, updateProfile } = useAuth();
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const styles = makeStyles(c, isDark);
  const [products, setProducts] = useState<ZcStoreProduct[]>([]);
  const [filter, setFilter] = useState<ShopFilter>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadCatalog = async () => {
    try {
      const catalog = await getZcStoreCatalog();
      setProducts(catalog.items);
    } catch (error) {
      showLocalizedAlert('Shop xatosi', error instanceof Error ? error.message : 'Mahsulotlar yuklanmadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, []);

  const visibleProducts = useMemo(() => products.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'frames') return item.kind === 'frame' && !item.value.endsWith('3d');
    if (filter === 'effects') return item.kind === 'frame' && item.value.endsWith('3d');
    if (filter === 'badges') return item.kind === 'badge';
    if (filter === 'avatars') return item.kind === 'decoration' && ['book_wings', 'laurel_wreath'].includes(item.value);
    return item.kind === 'decoration' && !['book_wings', 'laurel_wreath'].includes(item.value);
  }), [products, filter]);

  const handleProduct = async (item: ZcStoreProduct) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      if (!item.owned) {
        await purchaseZcStoreItem(item.id);
      } else {
        if (item.kind === 'frame') await updateProfile({ profileFrame: item.value });
        else if (item.kind === 'decoration') await updateProfile({ avatarDecoration: item.value });
        else await updateProfile({ profileBadge: item.value });
      }
      await Promise.all([refreshUser(), loadCatalog()]);
      showLocalizedAlert(item.owned ? 'Jihozlandi' : 'Xarid muvaffaqiyatli', item.name + ' profilingizga saqlandi.');
    } catch (error) {
      showLocalizedAlert('Amal bajarilmadi', error instanceof Error ? error.message : 'ZC Shop bilan aloqa xatosi.');
    } finally {
      setBusyId(null);
    }
  };

  const previewIcon = (item: ZcStoreProduct): keyof typeof Ionicons.glyphMap => {
    if (item.kind === 'badge') {
      if (item.value === 'legend') return 'ribbon';
      if (item.value === 'champion') return 'trophy';
      if (item.value === 'scholar') return 'book';
      return 'flame';
    }
    if (item.kind === 'decoration') {
      if (item.value === 'crown') return 'ribbon';
      if (item.value === 'laurel') return 'leaf';
      return 'star';
    }
    return 'person';
  };

  const frameStyle = (value: string) => {
    if (value === 'aurora') return styles.frameAurora;
    if (value === 'royal') return styles.frameRoyal;
    if (value === 'ocean') return styles.frameOcean;
    if (value === 'neon3d') return styles.frameNeon3d;
    if (value === 'inferno3d') return styles.frameInferno3d;
    if (value === 'frost3d') return styles.frameFrost3d;
    if (value === 'galaxy3d') return styles.frameGalaxy3d;
    return null;
  };

  if (!user) return <View style={styles.center}><ActivityIndicator color={c.primary} /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}><Ionicons name="arrow-back" size={22} color={c.text} /></Pressable>
        <View style={styles.headerTitleWrap}>
          <LocalizedText style={styles.eyebrow}>ZELQEN CORE</LocalizedText>
          <LocalizedText style={styles.title}>ZC SHOP</LocalizedText>
        </View>
        <View style={styles.balance}><LocalizedText style={styles.balanceValue}>{Number(user.zcBalance ?? 0).toLocaleString('en-US')}</LocalizedText><LocalizedText style={styles.balanceLabel}>ZC</LocalizedText></View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}><Ionicons name="sparkles" size={25} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.bannerTitle}>Profilingni bezat!</LocalizedText>
            <LocalizedText style={styles.bannerText}>Nishonlar, ramkalar, 3D effektlar va jonli avatarlarni ZC orqali och.</LocalizedText>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, filter === item.id && styles.filterActive]}>
              <Ionicons name={item.icon} size={14} color={filter === item.id ? '#FFFFFF' : c.textMuted} />
              <LocalizedText style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</LocalizedText>
            </Pressable>
          ))}
        </ScrollView>
        {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 35 }} /> : (
          <View style={styles.grid}>
            {visibleProducts.map((item) => {
              const equipped = item.kind === 'frame' ? user.profileFrame === item.value : item.kind === 'decoration' ? user.avatarDecoration === item.value : user.profileBadge === item.value;
              const isFrame = item.kind === 'frame';
              return (
                <View key={item.id} style={styles.product}>
                  <View style={styles.previewStage}>
                    {item.kind === 'badge' ? (
                      <AnimatedBadge value={item.value} size={82} />
                    ) : item.kind === 'decoration' && item.value === 'laurel_wreath' ? (
                      <LaurelWreathAvatar size={110} imageUri={user.avatarUrl} initials={user.displayName.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'} />
                    ) : item.kind === 'decoration' && item.value === 'book_wings' ? (
                      <BookWingsAvatar size={100} imageUri={user.avatarUrl} initials={user.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'} />
                    ) : isFrame ? (
                      <View style={[styles.avatarPreview, frameStyle(item.value)]}>
                        {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} /> : <Ionicons name="person" size={32} color="#FFFFFF" />}
                      </View>
                    ) : (
                      <View style={[styles.symbolPreview, item.kind === 'badge' && styles.badgePreview]}>
                        <Ionicons name={previewIcon(item)} size={32} color={item.kind === 'badge' ? '#F5D27A' : '#C5B4FF'} />
                      </View>
                    )}
                    {item.value.endsWith('3d') ? <View style={styles.threeDPill}><LocalizedText style={styles.threeDText}>3D EFFECT</LocalizedText></View> : null}
                    {item.kind === 'badge' ? <View style={styles.examplePill}><LocalizedText style={styles.exampleText}>NISHON NAMUNASI</LocalizedText></View> : null}
                  </View>
                  <LocalizedText style={styles.productName} numberOfLines={1}>{item.name}</LocalizedText>
                  <LocalizedText style={styles.productDescription} numberOfLines={2}>{item.description}</LocalizedText>
                  <View style={styles.productFooter}>
                    <View><LocalizedText style={styles.price}>{item.owned ? 'Sotib olingan' : item.price + ' ZC'}</LocalizedText>{item.owned ? <LocalizedText style={styles.ownedHint}>Akkauntingizda saqlangan</LocalizedText> : null}</View>
                    <Pressable disabled={busyId !== null || equipped} onPress={() => void handleProduct(item)} style={[styles.buyButton, equipped && styles.equippedButton]}>
                      {busyId === item.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <LocalizedText style={styles.buyText}>{equipped ? 'Tanlangan' : item.owned ? 'Jihozlash' : 'Sotib olish'}</LocalizedText>}
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {visibleProducts.length === 0 ? <LocalizedText style={styles.empty}>Bu turda hozircha mahsulot yo‘q.</LocalizedText> : null}
          </View>
        )}
        <LocalizedText style={styles.footnote}>Har bir xarid serverdagi akkauntingizga yoziladi. Ilovaga qayta kirganingizda ham xaridlaringiz saqlanadi.</LocalizedText>
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    header: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    headerTitleWrap: { flex: 1 },
    eyebrow: { color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
    title: { color: c.text, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
    balance: { alignItems: 'flex-end' },
    balanceValue: { color: '#D9B65B', fontSize: 18, fontWeight: '900' },
    balanceLabel: { color: c.textMuted, fontSize: 10, fontWeight: '800' },
    content: { padding: 17, paddingBottom: 125 },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 21, backgroundColor: isDark ? '#211A36' : '#F0EBFF', borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    bannerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7955D9' },
    bannerTitle: { color: c.text, fontSize: 16, fontWeight: '900' },
    bannerText: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
    filters: { gap: 8, paddingBottom: 15 },
    filter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    filterActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterText: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    filterTextActive: { color: '#FFFFFF' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
    product: { width: '48.5%', minHeight: 235, padding: 11, borderRadius: 19, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    previewStage: { height: 105, alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' },
    avatarPreview: { width: 76, height: 76, borderRadius: 38, padding: 4, borderWidth: 3, borderColor: c.primary, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { width: '100%', height: '100%', borderRadius: 40 },
    frameAurora: { borderColor: '#A78BFA', backgroundColor: '#6D55C5' },
    frameRoyal: { borderColor: '#F2CE73', backgroundColor: '#B78B2D' },
    frameOcean: { borderColor: '#60A5FA', backgroundColor: '#256D9C' },
    frameNeon3d: { borderColor: '#E9D5FF', borderWidth: 5, shadowColor: '#A855F7', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#7C3AED' },
    frameInferno3d: { borderColor: '#FED7AA', borderWidth: 5, shadowColor: '#F97316', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#C2410C' },
    frameFrost3d: { borderColor: '#BAE6FD', borderWidth: 5, shadowColor: '#38BDF8', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#0369A1' },
    frameGalaxy3d: { borderColor: '#DDD6FE', borderWidth: 5, shadowColor: '#818CF8', shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 17, backgroundColor: '#4338CA' },
    symbolPreview: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#30274A' : '#F0EBFF', borderWidth: 1, borderColor: c.border },
    badgePreview: { borderRadius: 38, borderWidth: 2, borderColor: '#D6B66A', backgroundColor: isDark ? '#332A1B' : '#FFF7DF' },
    threeDPill: { position: 'absolute', right: 0, top: 0, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#7C3AED' },
    threeDText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
    examplePill: { position: 'absolute', left: 0, bottom: 0, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: '#A47A2A' },
    exampleText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900' },
    productName: { color: c.text, fontSize: 13, fontWeight: '800' },
    productDescription: { color: c.textMuted, fontSize: 10, lineHeight: 14, minHeight: 29, marginTop: 4 },
    productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, marginTop: 10 },
    price: { color: '#D9B65B', fontSize: 11, fontWeight: '900' },
    ownedHint: { color: c.textMuted, fontSize: 8, marginTop: 2 },
    buyButton: { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 10, backgroundColor: c.primary, minWidth: 82, alignItems: 'center' },
    equippedButton: { backgroundColor: c.surfaceElevated },
    buyText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
    empty: { color: c.textMuted, textAlign: 'center', padding: 25, width: '100%' },
    footnote: { color: c.textMuted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 18 },
  });
}
