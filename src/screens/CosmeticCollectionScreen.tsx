import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getZcStoreCatalog()
      .then((catalog) => { if (active) setItems(catalog.items.filter((item) => item.owned)); })
      .catch((error) => showLocalizedAlert('Kolleksiya yuklanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
  const initials = (user?.displayName ?? 'U').trim().split(/\\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  const selectedLabel = kind === 'frame' ? (FRAME_NAMES[selection.frame ?? ''] ?? 'Standart ramka')
    : kind === 'badge' ? (BADGE_NAMES[selection.badge ?? ''] ?? 'Nishonsiz')
    : ({ crown: 'Toj', laurel: 'Laurel', star: 'Yulduz', sparkle: 'Yulduzcha' }[selection.decoration ?? ''] ?? 'Bezaksiz');

  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={onBack}><Ionicons name="arrow-back" size={22} color={c.text} /></Pressable>
      <View style={{ flex: 1 }}><LocalizedText style={styles.eyebrow}>ZELQEN CORE</LocalizedText><LocalizedText style={styles.title}>Mening kolleksiyam</LocalizedText></View>
      <View style={styles.count}><LocalizedText style={styles.countText}>{items.length}</LocalizedText><LocalizedText style={styles.countCaption}>BUYUM</LocalizedText></View>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.previewCard}>
        <View style={styles.previewTop}><Ionicons name="eye-outline" size={16} color={c.primary} /><LocalizedText style={styles.previewTitle}>PROFILDA QANDAY KO‘RINADI</LocalizedText><View style={{ flex: 1 }} /><LocalizedText style={styles.live}>JONLI KO‘RINISH</LocalizedText></View>
        <View style={styles.profilePreview}>
          <View style={[styles.avatarFrame, frameStyle(selection.frame)]}>
            {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatar} /> : <LocalizedText style={styles.initials}>{initials || 'U'}</LocalizedText>}
          </View>
          {selection.decoration ? <View style={styles.decoration}><Ionicons name={selection.decoration === 'crown' ? 'ribbon' : selection.decoration === 'laurel' ? 'leaf' : 'star'} size={15} color="#F5D27A" /></View> : null}
          <LocalizedText style={styles.displayName}>{user?.displayName ?? 'Foydalanuvchi'}</LocalizedText>
          <LocalizedText style={styles.username}>@{user?.username ?? 'username'}</LocalizedText>
          {selection.badge ? <View style={styles.badge}><Ionicons name={selection.badge === 'legend' ? 'ribbon' : selection.badge === 'champion' ? 'trophy' : selection.badge === 'scholar' ? 'book' : 'flame'} size={15} color="#F5D27A" /><LocalizedText style={styles.badgeText}>{BADGE_NAMES[selection.badge] ?? selection.badge.toUpperCase()}</LocalizedText></View> : null}
        </View>
        <View style={styles.previewFooter}><LocalizedText style={styles.previewFooterLabel}>Tanlanayotgan: </LocalizedText><LocalizedText style={styles.previewFooterValue}>{selectedLabel}</LocalizedText></View>
      </View>
      <View style={styles.tabs}>{TABS.map((tab) => <Pressable key={tab.id} onPress={() => setKind(tab.id)} style={[styles.tab, kind === tab.id && styles.tabActive]}><Ionicons name={tab.icon} size={16} color={kind === tab.id ? '#FFFFFF' : c.textMuted} /><LocalizedText style={[styles.tabText, kind === tab.id && styles.tabTextActive]}>{tab.label}</LocalizedText></Pressable>)}</View>
      {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /> : visibleItems.length ? <View style={styles.grid}>
        {visibleItems.map((item) => {
          const selected = currentValue === item.value;
          return <Pressable key={item.id} onPress={() => choose(item.value)} style={[styles.item, selected && styles.itemSelected]}>
            <View style={styles.itemStage}>
              {item.kind === 'frame' ? <View style={[styles.miniAvatarFrame, frameStyle(item.value)]}>{user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.miniAvatar} /> : <Ionicons name="person" size={26} color="#FFFFFF" />}</View>
                : <View style={styles.badgeSample}><Ionicons name={item.kind === 'badge' ? (item.value === 'legend' ? 'ribbon' : item.value === 'champion' ? 'trophy' : item.value === 'scholar' ? 'book' : 'flame') : (item.value === 'crown' ? 'ribbon' : item.value === 'laurel' ? 'leaf' : 'star')} size={30} color={item.kind === 'badge' ? '#D6B66A' : '#C5B4FF'} /></View>}
            </View>
            <LocalizedText style={styles.itemName} numberOfLines={1}>{item.name}</LocalizedText>
            <LocalizedText style={styles.itemDescription} numberOfLines={2}>{item.description}</LocalizedText>
            <View style={styles.itemBottom}><LocalizedText style={styles.ownedLabel}>Sotib olingan</LocalizedText><Ionicons name={selected ? 'checkmark-circle' : 'radio-button-off'} size={19} color={selected ? '#22C55E' : c.textMuted} /></View>
          </Pressable>;
        })}
      </View> : <View style={styles.empty}><Ionicons name="albums-outline" size={38} color={c.textMuted} /><LocalizedText style={styles.emptyTitle}>Bu turdagi buyumlar hali yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>ZC Shop’dan sotib olgan buyumlaringiz shu yerda paydo bo‘ladi.</LocalizedText></View>}
      {visibleItems.length > 0 ? <View style={styles.actionRow}>
        <Pressable style={styles.resetButton} onPress={() => choose(null)} disabled={saving}><LocalizedText style={styles.resetText}>Olib tashlash</LocalizedText></Pressable>
        <Pressable style={styles.applyButton} onPress={() => void apply()} disabled={saving || currentValue === (kind === 'frame' ? user?.profileFrame : kind === 'badge' ? user?.profileBadge : user?.avatarDecoration)}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark" size={17} color="#FFFFFF" /><LocalizedText style={styles.applyText}>Qo‘llash</LocalizedText></>}
        </Pressable>
      </View> : null}
      <LocalizedText style={styles.note}>Tanlov avval shu oynada ko‘rinadi. “Qo‘llash” bosilgandagina profilingiz o‘zgaradi. Xarid qilingan buyumlar kolleksiyada qoladi.</LocalizedText>
    </ScrollView>
  </View>;
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background }, header: { minHeight: 68, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }, back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }, eyebrow: { color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2 }, title: { color: c.text, fontSize: 18, fontWeight: '900' }, count: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: c.surface }, countText: { color: c.primary, fontSize: 16, fontWeight: '900' }, countCaption: { color: c.textMuted, fontSize: 7, fontWeight: '800' }, content: { padding: 16, paddingBottom: 120 },
    previewCard: { borderRadius: 22, padding: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 16 }, previewTop: { flexDirection: 'row', alignItems: 'center', gap: 7 }, previewTitle: { color: c.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, live: { color: '#22C55E', fontSize: 8, fontWeight: '900' }, profilePreview: { alignItems: 'center', paddingVertical: 17 }, avatarFrame: { width: 92, height: 92, borderRadius: 46, padding: 5, borderWidth: 3, borderColor: c.primary, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, avatar: { width: '100%', height: '100%', borderRadius: 44 }, initials: { color: c.text, fontSize: 28, fontWeight: '900' }, decoration: { position: 'absolute', top: 14, left: '37%', width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, displayName: { color: c.text, fontSize: 16, fontWeight: '900', marginTop: 10 }, username: { color: c.textMuted, fontSize: 11, marginTop: 2 }, badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 15, backgroundColor: 'rgba(214,182,106,0.14)', borderWidth: 1, borderColor: '#B88F45', marginTop: 9 }, badgeText: { color: '#D6B66A', fontSize: 10, fontWeight: '900' }, previewFooter: { flexDirection: 'row', justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }, previewFooterLabel: { color: c.textMuted, fontSize: 10 }, previewFooterValue: { color: c.text, fontSize: 10, fontWeight: '800' },
    tabs: { flexDirection: 'row', gap: 7, marginBottom: 14 }, tab: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, tabActive: { backgroundColor: c.primary, borderColor: c.primary }, tabText: { color: c.textMuted, fontSize: 10, fontWeight: '800' }, tabTextActive: { color: '#FFFFFF' }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 }, item: { width: '48.5%', minHeight: 190, borderRadius: 17, padding: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, itemSelected: { borderColor: c.primary, borderWidth: 2 }, itemStage: { height: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, miniAvatarFrame: { width: 60, height: 60, borderRadius: 30, padding: 4, borderWidth: 3, borderColor: c.primary, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, miniAvatar: { width: '100%', height: '100%', borderRadius: 30 }, badgeSample: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#332A1B' : '#FFF7DF', borderWidth: 2, borderColor: '#D6B66A' }, itemName: { color: c.text, fontSize: 12, fontWeight: '900' }, itemDescription: { color: c.textMuted, fontSize: 9, lineHeight: 13, minHeight: 27, marginTop: 3 }, itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, ownedLabel: { color: '#22C55E', fontSize: 9, fontWeight: '800' }, empty: { alignItems: 'center', padding: 30, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border }, emptyTitle: { color: c.text, fontWeight: '900', marginTop: 10 }, emptyText: { color: c.textMuted, textAlign: 'center', fontSize: 11, marginTop: 5, lineHeight: 16 }, actionRow: { flexDirection: 'row', gap: 9, marginTop: 15 }, resetButton: { paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', borderRadius: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, resetText: { color: c.textMuted, fontSize: 11, fontWeight: '800' }, applyButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: c.primary, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, applyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, note: { color: c.textMuted, textAlign: 'center', fontSize: 9, lineHeight: 14, marginTop: 15 },
    frameAurora: { borderColor: '#A78BFA', backgroundColor: '#6D55C5' }, frameRoyal: { borderColor: '#F2CE73', backgroundColor: '#B78B2D' }, frameOcean: { borderColor: '#60A5FA', backgroundColor: '#256D9C' }, frameNeon3d: { borderColor: '#E9D5FF', borderWidth: 5, shadowColor: '#A855F7', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#7C3AED' }, frameInferno3d: { borderColor: '#FED7AA', borderWidth: 5, shadowColor: '#F97316', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#C2410C' }, frameFrost3d: { borderColor: '#BAE6FD', borderWidth: 5, shadowColor: '#38BDF8', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16, backgroundColor: '#0369A1' }, frameGalaxy3d: { borderColor: '#DDD6FE', borderWidth: 5, shadowColor: '#818CF8', shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 17, backgroundColor: '#4338CA' },
  });
}
