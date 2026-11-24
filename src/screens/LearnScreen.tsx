import { LocalizedText, LocalizedTextInput } from '../i18n/LocalizedText';
import { useMemo, useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, NativeText, View, Pressable, NativeTextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { subjects } from '../data/subjects';
import type { Subject, Topic } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface LearnScreenProps {
  initialSubject?: Subject | null;
  onTopicSelect?: (subject: Subject, topic: Topic) => void;
  dockStretch?: SharedValue<number>;
}

const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export default function LearnScreen({ initialSubject, onTopicSelect, dockStretch }: LearnScreenProps) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
  const lastDockScrollY = useSharedValue(0);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(initialSubject ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const dockScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!dockStretch) return;
      const nextY = event.contentOffset.y;
      const delta = nextY - lastDockScrollY.value;
      lastDockScrollY.value = nextY;
      dockStretch.value = withSpring(Math.max(-1, Math.min(1, delta / 30)), { damping: 11, stiffness: 160, mass: 0.7 });
    },
    onEndDrag: () => { if (dockStretch) dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }); },
    onMomentumEnd: () => { if (dockStretch) dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }); },
  });

  const filteredSubjects = useMemo(() => {
    const query = normalize(searchQuery);
    return query ? subjects.filter((subject) => normalize(subject.name + ' ' + subject.description).includes(query)) : subjects;
  }, [searchQuery]);
  const filteredTopics = useMemo(() => {
    if (!selectedSubject) return [];
    const query = normalize(searchQuery);
    return query ? selectedSubject.topics.filter((topic) => normalize(topic.name + ' ' + topic.description).includes(query)) : selectedSubject.topics;
  }, [selectedSubject, searchQuery]);

  return (
    <Animated.ScrollView
      onScroll={dockScrollHandler}
      scrollEventThrottle={16}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {selectedSubject ? (
        <>
          <Pressable style={styles.backButton} onPress={() => { setSelectedSubject(null); setSearchQuery(''); }}>
            <Ionicons name="chevron-back" size={17} color={colors.primary} />
            <LocalizedText style={styles.backText}>Barcha fanlar</LocalizedText>
          </Pressable>
          <View style={styles.detailHeader}>
            <View style={[styles.largeIconBox, { backgroundColor: selectedSubject.color + '20', borderColor: selectedSubject.color + '55' }]}>
              <LocalizedText style={[styles.largeIcon, { color: selectedSubject.color }]}>{selectedSubject.icon}</LocalizedText>
            </View>
            <LocalizedText style={styles.title}>{selectedSubject.name}</LocalizedText>
            <LocalizedText style={styles.subtitle}>{selectedSubject.description}</LocalizedText>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={colors.textMuted} />
            <LocalizedTextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Mavzularni qidiring..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" autoCorrect={false} />
            {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>}
          </View>
          <View style={styles.sectionHeader}>
            <LocalizedText style={styles.sectionTitle}>Mavzular</LocalizedText>
            <LocalizedText style={styles.sectionCount}>{filteredTopics.length} ta</LocalizedText>
          </View>
          {filteredTopics.map((topic) => {
            const index = selectedSubject.topics.findIndex((item) => item.id === topic.id);
            return (
              <Pressable key={topic.id} style={({ pressed }) => [styles.topicCard, pressed && styles.pressed]} onPress={() => onTopicSelect?.(selectedSubject, topic)}>
                <View style={styles.topicNumber}><LocalizedText style={styles.numberText}>{String(index + 1).padStart(2, '0')}</LocalizedText></View>
                <View style={styles.topicInfo}>
                  <LocalizedText style={styles.topicName}>{topic.name}</LocalizedText>
                  <LocalizedText style={styles.topicDescription}>{topic.description}</LocalizedText>
                  <LocalizedText style={styles.questionCount}>{topic.questionCount} ta savol · Bazada saqlanadi</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
              </Pressable>
            );
          })}
          {filteredTopics.length === 0 && <LocalizedText style={styles.emptyText}>Bu qidiruv bo‘yicha mavzu topilmadi.</LocalizedText>}
        </>
      ) : (
        <>
          <View style={styles.header}>
            <LocalizedText style={styles.eyebrow}>QUIZ ARENA  /  TA'LIM</LocalizedText>
            <LocalizedText style={styles.title}>Fanlar</LocalizedText>
            <LocalizedText style={styles.subtitle}>O‘zingizga kerakli fanni tanlang va bilim sari yo‘l oling.</LocalizedText>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={colors.textMuted} />
            <LocalizedTextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Fanlarni qidiring..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" autoCorrect={false} />
            {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>}
          </View>
          <View style={styles.moonPanel}>
            <View pointerEvents="none" style={styles.moonGlow} />
            <View pointerEvents="none" style={styles.moonDisc}><LocalizedText style={styles.moonGlyph}>☾</LocalizedText></View>
            <View style={styles.moonCaption}><LocalizedText style={styles.moonCaptionTitle}>Bilim olamiga xush kelibsiz</LocalizedText><LocalizedText style={styles.moonCaptionText}>Fanni tanlang — mavzularni kashf eting</LocalizedText></View>
            <View style={styles.moonGrid}>
              {filteredSubjects.map((subject, index) => {
                const column = index % 3;
                return (
                  <Pressable key={subject.id} style={({ pressed }) => [styles.moonSubjectCard, { marginTop: column === 1 ? 0 : 34, borderColor: subject.color + '66' }, pressed && styles.pressed]} onPress={() => { setSelectedSubject(subject); setSearchQuery(''); }}>
                    <View style={[styles.moonSubjectIcon, { backgroundColor: subject.color + '22' }]}><LocalizedText style={[styles.moonSubjectGlyph, { color: subject.color }]}>{subject.icon}</LocalizedText></View>
                    <LocalizedText style={styles.moonSubjectName} numberOfLines={2}>{subject.name}</LocalizedText>
                    <LocalizedText style={styles.moonSubjectCount}>{subject.topics.length} mavzu</LocalizedText>
                  </Pressable>
                );
              })}
            </View>
            {filteredSubjects.length === 0 && <LocalizedText style={styles.emptyText}>Bu qidiruv bo‘yicha fan topilmadi.</LocalizedText>}
          </View>
          <LocalizedText style={styles.footerHint}>Har bir fan ichida mavzular alohida ochiladi.</LocalizedText>
        </>
      )}
    </Animated.ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 132 },
    header: { marginTop: 8, marginBottom: 18 },
    eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
    title: { color: colors.text, fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7 },
    searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.surfaceGlass, marginBottom: 20 },
    searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, paddingVertical: 11 },
    moonPanel: { minHeight: 500, borderRadius: 28, padding: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceGlass },
    moonGlow: { position: 'absolute', width: 250, height: 250, borderRadius: 125, top: 82, alignSelf: 'center', backgroundColor: colors.primary + '16' },
    moonDisc: { position: 'absolute', top: 105, alignSelf: 'center', width: 170, height: 170, borderRadius: 85, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '12', borderWidth: 1, borderColor: colors.primary + '35' },
    moonGlyph: { fontSize: 112, lineHeight: 130, color: colors.primary, opacity: 0.28 },
    moonCaption: { alignItems: 'center', marginTop: 16, marginBottom: 15 },
    moonCaptionTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
    moonCaptionText: { color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },
    moonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 8 },
    moonSubjectCard: { width: '31.5%', minHeight: 106, paddingVertical: 10, paddingHorizontal: 5, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.surfaceGlass, alignItems: 'center', justifyContent: 'center' },
    moonSubjectIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
    moonSubjectGlyph: { fontSize: 23, fontWeight: '800' },
    moonSubjectName: { color: colors.text, fontSize: 11, fontWeight: '800', textAlign: 'center', minHeight: 28 },
    moonSubjectCount: { color: colors.textMuted, fontSize: 9, marginTop: 3 },
    footerHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 14 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    sectionCount: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    backButton: { minHeight: 42, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 14, paddingRight: 18 },
    backText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    detailHeader: { alignItems: 'center', marginBottom: 22 },
    largeIconBox: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1 },
    largeIcon: { fontSize: 41, fontWeight: '800' },
    topicCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceGlass, borderRadius: 18, padding: 14, marginBottom: 9, borderWidth: 1, borderColor: colors.border, gap: 10 },
    topicNumber: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    numberText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    topicInfo: { flex: 1, minWidth: 0 },
    topicName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    topicDescription: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
    questionCount: { color: colors.primary, fontSize: 10, fontWeight: '600', marginTop: 6 },
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  });
}
