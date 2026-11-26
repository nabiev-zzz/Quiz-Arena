import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import BookWingsAvatar from '../components/BookWingsAvatar';
import LaurelWreathAvatar from '../components/LaurelWreathAvatar';
import { getZcStoreCatalog, type ZcStoreProduct } from '../services/zcStoreService';

type Kind = 'frame' | 'badge' | 'decoration';
type Selection = { frame: string | null; badge: string | null; decoration: string | null };
const TABS: { id: Kind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'frame', label: 'Ramkalar', icon: 'ellipse-outline' },
  { id: 'badge', label: 'Nishonlar', icon: 'medal-outline' },
  { id: 'decoration', label: 'Bezaklar', icon: 'sparkles-outline' },
];
const FRAME_NAMES: Record<string, string> = { aurora: 'Aurora', royal: 'Royal', ocean: 'Ocean', neon3d: 'Neon 3D', inferno3d: 'Inferno 3D', frost3d: 'Frost 3D', galaxy3d: 'Galaxy 3D' };
const BADGE_NAMES: Record<string, string> = { legend: 'LEGEND', champion: 'CHAMPION', scholar: 'SCHOLAR', streak: 'STREAK' };

export default function CosmeticCollectionScreen({ onBack }: { onBack: () => void }) {
  const { user, updateProfile, refreshUser } = useAuth();
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const styles = makeStyles(c, isDark);
  const [items, setItems] = useState<ZcStoreProduct[]>([]);
  const [kind, setKind] = useState<Kind>('frame');
  const [selection, setSelection] = useState<Selection>({ frame: null, badge: null, decoration: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    getZcStoreCatalog()
      .then((catalog) => { if (active) setItems(catalog.items.filter((item) => item.owned)); })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Kolleksiyani yuklab bo‘lmadi.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (user) setSelection({ frame: user.profileFrame, badge: user.profileBadge ?? null, decoration: user.avatarDecoration });
  }, [user?.profileFrame, user?.profileBadge, user?.avatarDecoration]);

  const visibleItems = useMemo(() => items.filter((item) => item.kind === kind), [items, kind]);
  const currentValue = selection[kind];
  const frameStyle = (value: string | null) => {
    if (value === 'aurora') return styles.frameAurora;
    if (value === 'royal') return styles.frameRoyal;
    if (value === 'ocean') return styles.frameOcean;
    if (value === 'neon3d') return styles.frameNeon3d;
    if (value === 'inferno3d') return styles.frameInferno3d;
    if (value === 'frost3d') return styles.frameFrost3d;
    if (value === 'galaxy3d') return styles.frameGalaxy3d;
    return null;
  };
  const choose = (value: string | null) => setSelection((old) => ({ ...old, [kind]: value }));
  const apply = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      if (kind === 'frame') await updateProfile({ profileFrame: selection.frame });
      else if (kind === 'badge') await updateProfile({ profileBadge: selection.badge });
      else await updateProfile({ avatarDecoration: selection.decoration });
      await refreshUser();
      showLocalizedAlert('Saqlandi', 'Tanlangan ko‘rinish profilingizga qo‘llandi.');
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Tanlovni saqlab bo‘lmadi.');
    } finally { setSaving(false); }
  };
  const initials = (user?.displayName ?? 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  const selectedLabel = kind === 'frame'
    ? (selection.frame ? (FRAME_NAMES[selection.frame] ?? selection.frame) : 'Standart ramka')
    : kind === 'badge'
      ? (selection.badge ? (BADGE_NAMES[selection.badge] ?? selection.badge.toUpperCase()) : 'Nishonsiz')
      : (selection.decoration ? ({ crown: 'Toj', laurel: 'Laurel', star: 'Yulduz', sparkle: 'Yulduzcha', book_wings: 'Kitob qanotlari', laurel_wreath: 'Dafna toji' }[selection.decoration] ?? selection.decoration) : 'Bezaksiz');
  const showActions = visibleItems.length > 0 || Boolean(currentValue);

  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable style={({ pressed }) => [styles.back, pressed && styles.controlPressed]} onPress={onBack}><Ionicons name="arrow-back" size={22} color={c.text} /></Pressable>
      <View style={{ flex: 1 }}><LocalizedText style={styles.eyebrow}>ZELQEN CORE</LocalizedText><LocalizedText style={styles.title}>Mening kolleksiyam</LocalizedText></View>
      <View style={styles.count}><LocalizedText style={styles.countText}>{items.length}</LocalizedText><LocalizedText style={styles.countCaption}>BUYUM</LocalizedText></View>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.previewCard}>
        <View style={styles.previewGlow} />
        <View style={styles.previewTop}><Ionicons name="eye-outline" size={16} color={c.primary} /><LocalizedText style={styles.previewTitle}>PROFILDA QANDAY KO‘RINADI</LocalizedText><View style={{ flex: 1 }} /><LocalizedText style={styles.live}>JONLI KO‘RINISH</LocalizedText></View>
        <View style={styles.profilePreview}>
          {selection.decoration === 'laurel_wreath' ? (
            <LaurelWreathAvatar size={148} imageUri={user?.avatarUrl} initials={initials || 'U'} frameColor={selection.frame === 'aurora' ? '#A78BFA' : selection.frame === 'royal' ? '#F2CE73' : selection.frame === 'ocean' ? '#60A5FA' : selection.frame === 'neon3d' ? '#E9D5FF' : selection.frame === 'inferno3d' ? '#FED7AA' : selection.frame === 'frost3d' ? '#BAE6FD' : selection.frame === 'galaxy3d' ? '#DDD6FE' : '#FBBF24'} />
          ) : selection.decoration === 'book_wings' ? (
            <BookWingsAvatar size={136} imageUri={user?.avatarUrl} initials={initials || 'U'} frameColor={selection.frame === 'aurora' ? '#A78BFA' : selection.frame === 'royal' ? '#F2CE73' : selection.frame === 'ocean' ? '#60A5FA' : selection.frame === 'neon3d' ? '#E9D5FF' : selection.frame === 'inferno3d' ? '#FED7AA' : selection.frame === 'frost3d' ? '#BAE6FD' : selection.frame === 'galaxy3d' ? '#DDD6FE' : '#FBBF24'} />
          ) : <>
            <View style={[styles.avatarFrame, frameStyle(selection.frame)]}>
              {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatar} /> : <LocalizedText style={styles.initials}>{initials || 'U'}</LocalizedText>}
            </View>
            {selection.decoration ? <View style={styles.decoration}><Ionicons name={selection.decoration === 'crown' ? 'ribbon' : selection.decoration === 'laurel' ? 'leaf' : 'star'} size={15} color="#F5D27A" /></View> : null}
          </>}
          <LocalizedText style={styles.displayName}>{user?.displayName ?? 'Foydalanuvchi'}</LocalizedText>
          <LocalizedText style={styles.username}>@{user?.username ?? 'username'}</LocalizedText>
          {selection.badge ? <View style={styles.badge}><Ionicons name={selection.badge === 'legend' ? 'ribbon' : selection.badge === 'champion' ? 'trophy' : selection.badge === 'scholar' ? 'book' : 'flame'} size={15} color="#F5D27A" /><LocalizedText style={styles.badgeText}>{BADGE_NAMES[selection.badge] ?? selection.badge.toUpperCase()}</LocalizedText></View> : null}
        </View>
        <View style={styles.previewFooter}><LocalizedText style={styles.previewFooterLabel}>Tanlanayotgan: </LocalizedText><LocalizedText style={styles.previewFooterValue}>{selectedLabel}</LocalizedText></View>
      </View>
      <View style={styles.tabs}>{TABS.map((tab) => <Pressable key={tab.id} onPress={() => setKind(tab.id)} style={({ pressed }) => [styles.tab, kind === tab.id && styles.tabActive, pressed && styles.controlPressed]}><Ionicons name={tab.icon} size={16} color={kind === tab.id ? '#FFFFFF' : c.textMuted} /><LocalizedText style={[styles.tabText, kind === tab.id && styles.tabTextActive]}>{tab.label}</LocalizedText></Pressable>)}</View>
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /> : loadError ? (
        <View style={styles.errorState}>
          <Ionicons name="cloud-offline-outline" size={34} color={c.textMuted} />
          <LocalizedText style={styles.emptyTitle}>Kolleksiyani yuklab bo‘lmadi</LocalizedText>
          <LocalizedText style={styles.emptyText}>{loadError}</LocalizedText>
          <Pressable onPress={() => setReloadKey((value) => value + 1)} style={({ pressed }) => [styles.retryButton, pressed && styles.controlPressed]}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText>
          </Pressable>
        </View>
      ) : visibleItems.length ? <View style={styles.grid}>
        {visibleItems.map((item) => {
          const selected = currentValue === item.value;
          return <Pressable key={item.id} onPress={() => choose(item.value)} style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && styles.itemPressed]}>
            <View style={styles.itemStage}>
              {item.kind === 'frame' ? <View style={[styles.miniAvatarFrame, frameStyle(item.value)]}>{user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.miniAvatar} /> : <Ionicons name="person" size={26} color="#FFFFFF" />}</View>
                : item.value === 'laurel_wreath' ? <LaurelWreathAvatar size={96} imageUri={user?.avatarUrl} initials={initials || 'U'} />
                : item.value === 'book_wings' ? <BookWingsAvatar size={86} imageUri={user?.avatarUrl} initials={initials || 'U'} />
                : <View style={styles.badgeSample}><Ionicons name={item.kind === 'badge' ? (item.value === 'legend' ? 'ribbon' : item.value === 'champion' ? 'trophy' : item.value === 'scholar' ? 'book' : 'flame') : (item.value === 'crown' ? 'ribbon' : item.value === 'laurel' ? 'leaf' : 'star')} size={30} color={item.kind === 'badge' ? '#D6B66A' : '#C5B4FF'} /></View>}
            </View>
            <LocalizedText style={styles.itemName} numberOfLines={1}>{item.name}</LocalizedText>
            <LocalizedText style={styles.itemDescription} numberOfLines={2}>{item.description}</LocalizedText>
            <View style={styles.itemBottom}><View style={styles.ownedStatus}><Ionicons name="checkmark-circle" size={13} color="#22C55E" /><LocalizedText style={styles.ownedLabel}>Sizda bor</LocalizedText></View>{selected ? <View style={styles.selectedMark}><Ionicons name="checkmark" size={12} color="#FFFFFF" /><LocalizedText style={styles.selectedMarkText}>JIHOZLANGAN</LocalizedText></View> : <Ionicons name="radio-button-off" size={19} color={c.textMuted} />}</View>
          </Pressable>;
        })}
      </View> : <View style={styles.empty}><Ionicons name="albums-outline" size={38} color={c.textMuted} /><LocalizedText style={styles.emptyTitle}>Bu turdagi buyumlar hali yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>ZC Shop’dan sotib olgan buyumlaringiz shu yerda paydo bo‘ladi.</LocalizedText></View>}
      {showActions ? <View style={styles.actionRow}>
        <Pressable style={({ pressed }) => [styles.resetButton, (!currentValue || saving) && styles.buttonDisabled, pressed && styles.controlPressed]} onPress={() => choose(null)} disabled={saving || !currentValue}><Ionicons name="close-circle-outline" size={17} color={c.textMuted} /><LocalizedText style={styles.resetText}>Olib tashlash</LocalizedText></Pressable>
        <Pressable style={({ pressed }) => [styles.applyButton, (saving || currentValue === (kind === 'frame' ? user?.profileFrame : kind === 'badge' ? user?.profileBadge : user?.avatarDecoration)) && styles.buttonDisabled, pressed && styles.controlPressed]} onPress={() => void apply()} disabled={saving || currentValue === (kind === 'frame' ? user?.profileFrame : kind === 'badge' ? user?.profileBadge : user?.avatarDecoration)}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-done" size={18} color="#FFFFFF" /><LocalizedText style={styles.applyText}>Profilga qo‘llash</LocalizedText></>}</Pressable>
      </View> : null}
      <View style={styles.infoNote}><Ionicons name="shield-checkmark-outline" size={15} color={c.primary} /><LocalizedText style={styles.note}>Tanlovni avval jonli ko‘rinishda tekshiring. “Profilga qo‘llash” bosilgandagina o‘zgarish saqlanadi. Xaridlaringiz kolleksiyada qoladi.</LocalizedText></View>
    </ScrollView>
  </View>;
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background }, header: { minHeight: 68, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }, back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }, eyebrow: { color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2 }, title: { color: c.text, fontSize: 18, fontWeight: '900' }, count: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: c.surface }, countText: { color: c.primary, fontSize: 16, fontWeight: '900' }, countCaption: { color: c.textMuted, fontSize: 7, fontWeight: '800' }, content: { padding: 16, paddingBottom: 120 },
    previewCard: { borderRadius: 24, padding: 17, backgroundColor: isDark ? '#211A36' : '#F0EBFF', borderWidth: 1, borderColor: isDark ? '#49366B' : '#DDD3FF', marginBottom: 18, overflow: 'hidden', shadowColor: '#7655D6', shadowOpacity: isDark ? 0.16 : 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, previewGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -85, top: -85, backgroundColor: isDark ? 'rgba(167,139,250,0.12)' : 'rgba(167,139,250,0.18)' }, previewTop: { flexDirection: 'row', alignItems: 'center', gap: 7 }, previewTitle: { color: c.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, live: { color: '#22C55E', fontSize: 8, fontWeight: '900' }, profilePreview: { alignItems: 'center', paddingVertical: 17 }, avatarFrame: { width: 92, height: 92, borderRadius: 46, padding: 5, borderWidth: 3, borderColor: c.primary, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, avatar: { width: '100%', height: '100%', borderRadius: 44 }, initials: { color: c.text, fontSize: 28, fontWeight: '900' }, decoration: { position: 'absolute', top: 14, left: '37%', width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, displayName: { color: c.text, fontSize: 16, fontWeight: '900', marginTop: 10 }, username: { color: c.textMuted, fontSize: 11, marginTop: 2 }, badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 15, backgroundColor: 'rgba(214,182,106,0.14)', borderWidth: 1, borderColor: '#B88F45', marginTop: 9 }, badgeText: { color: '#D6B66A', fontSize: 10, fontWeight: '900' }, previewFooter: { flexDirection: 'row', justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }, previewFooterLabel: { color: c.textMuted, fontSize: 10 }, previewFooterValue: { color: c.text, fontSize: 10, fontWeight: '800' },
    tabs: { flexDirection: 'row', gap: 7, marginBottom: 15 }, tab: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, tabActive: { backgroundColor: c.primary, borderColor: c.primary, shadowColor: c.primary, shadowOpacity: 0.24, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 }, tabText: { color: c.textMuted, fontSize: 10, fontWeight: '800' }, tabTextActive: { color: '#FFFFFF' }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }, item: { width: '48.5%', minHeight: 198, borderRadius: 20, padding: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: '#000000', shadowOpacity: isDark ? 0.12 : 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, itemSelected: { borderColor: c.primary, borderWidth: 2, backgroundColor: isDark ? '#241C3B' : '#F7F4FF', shadowColor: c.primary, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 }, itemPressed: { transform: [{ scale: 0.985 }] }, itemStage: { height: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, miniAvatarFrame: { width: 60, height: 60, borderRadius: 30, padding: 4, borderWidth: 3, borderColor: c.primary, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, miniAvatar: { width: '100%', height: '100%', borderRadius: 30 }, badgeSample: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#332A1B' : '#FFF7DF', borderWidth: 2, borderColor: '#D6B66A' }, itemName: { color: c.text, fontSize: 12, fontWeight: '900' }, itemDescription: { color: c.textMuted, fontSize: 9, lineHeight: 13, minHeight: 27, marginTop: 3 }, itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, minHeight: 22 }, ownedStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 }, ownedLabel: { color: '#22C55E', fontSize: 9, fontWeight: '800' }, selectedMark: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#22A06B', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }, selectedMarkText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900', letterSpacing: 0.3 }, errorState: { alignItems: 'center', padding: 25, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border }, retryButton: { minHeight: 42, borderRadius: 12, backgroundColor: c.primary, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 13 }, retryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, empty: { alignItems: 'center', padding: 30, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border }, emptyTitle: { color: c.text, fontWeight: '900', marginTop: 10 }, emptyText: { color: c.textMuted, textAlign: 'center', fontSize: 11, marginTop: 5, lineHeight: 16 }, actionRow: { flexDirection: 'row', gap: 10, marginTop: 17 }, resetButton: { paddingHorizontal: 14, minHeight: 52, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, resetText: { color: c.textMuted, fontSize: 10, fontWeight: '800' }, applyButton: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: c.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 }, applyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.2 }, buttonDisabled: { opacity: 0.42, shadowOpacity: 0 }, controlPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 15, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, backgroundColor: isDark ? '#1D1A2A' : '#F5F2FF' }, note: { flex: 1, color: c.textMuted, textAlign: 'left', fontSize: 9, lineHeight: 15 },
    frameAurora: { borderColor: '#A78BFA', backgroundColor: '#6D55C5' }, frameRoyal: { borderColor: '#F2CE73', backgroundColor: '#B78B2D' }, frameOcean: { borderColor: '#60A5FA', backgroundColor: '#256D9C' }, frameNeon3d: { borderColor: '#E9D5FF', borderWidth: 5, shadowColor: '#A855F7', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#7C3AED' }, frameInferno3d: { borderColor: '#FED7AA', borderWidth: 5, shadowColor: '#F97316', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#C2410C' }, frameFrost3d: { borderColor: '#BAE6FD', borderWidth: 5, shadowColor: '#38BDF8', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#0369A1' }, frameGalaxy3d: { borderColor: '#DDD6FE', borderWidth: 5, shadowColor: '#818CF8', shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 17, backgroundColor: '#4338CA' },
  });
}
