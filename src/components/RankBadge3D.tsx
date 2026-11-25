import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../i18n/LocalizedText';

type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster';

const PALETTES: Record<RankTier, { colors: [string, string, ...string[]]; edge: string; icon: keyof typeof Ionicons.glyphMap; short: string }> = {
  Bronze: { colors: ['#F0B17A', '#9A542B', '#5D321F'], edge: '#F8C99B', icon: 'shield-outline', short: 'BRONZE' },
  Silver: { colors: ['#F1F5FA', '#8796AA', '#46566D'], edge: '#E5EDF7', icon: 'shield-half-outline', short: 'SILVER' },
  Gold: { colors: ['#FFE58A', '#D49A25', '#805514'], edge: '#FFF0B0', icon: 'trophy-outline', short: 'GOLD' },
  Platinum: { colors: ['#B6FFF0', '#43BFAE', '#176C70'], edge: '#D1FFF7', icon: 'diamond-outline', short: 'PLATINUM' },
  Diamond: { colors: ['#B9E8FF', '#4B9EE8', '#284D9D'], edge: '#D8F5FF', icon: 'diamond', short: 'DIAMOND' },
  Master: { colors: ['#E0C5FF', '#9364DF', '#4A2B8E'], edge: '#F0DEFF', icon: 'ribbon', short: 'MASTER' },
  Grandmaster: { colors: ['#FFE3A0', '#E56B48', '#792F58'], edge: '#FFF0C6', icon: 'flame', short: 'GRANDMASTER' },
};

function normalizeTier(tier?: string): RankTier {
  return tier && tier in PALETTES ? tier as RankTier : 'Bronze';
}

export function RankBadge3D({ tier, compact = false }: { tier?: string | null; compact?: boolean }) {
  const rank = normalizeTier(tier ?? undefined);
  const palette = PALETTES[rank];
  return (
    <View style={[styles.outer, compact && styles.outerCompact, { borderColor: palette.edge, shadowColor: palette.colors[1] }]}>
      <LinearGradient colors={palette.colors} start={{ x: 0.12, y: 0 }} end={{ x: 0.88, y: 1 }} style={[styles.face, compact && styles.faceCompact]}>
        <View style={[styles.gloss, compact && styles.glossCompact]} />
        <Ionicons name={palette.icon} size={compact ? 13 : 19} color="#FFFFFF" />
        {!compact && <LocalizedText style={styles.label}>{palette.short}</LocalizedText>}
      </LinearGradient>
      <View style={[styles.bottomEdge, compact && styles.bottomEdgeCompact]} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: 62, height: 55, borderRadius: 15, borderWidth: 1.5, padding: 2, backgroundColor: '#172033', shadowOpacity: 0.38, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 7, overflow: 'hidden' },
  outerCompact: { width: 29, height: 27, borderRadius: 9, padding: 1, borderWidth: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  face: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 2 },
  faceCompact: { borderRadius: 7 },
  gloss: { position: 'absolute', top: -15, left: -8, right: -8, height: 30, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.24)', transform: [{ rotate: '-12deg' }] },
  glossCompact: { top: -13, height: 18 },
  label: { color: '#FFFFFF', fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: 0.7, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3 },
  bottomEdge: { position: 'absolute', bottom: 1, left: 8, right: 8, height: 2, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)' },
  bottomEdgeCompact: { left: 4, right: 4, height: 1 },
});
