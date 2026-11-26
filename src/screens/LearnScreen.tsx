import { LocalizedText, LocalizedTextInput } from '../i18n/LocalizedText';
import { useMemo, useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, View, Pressable } from 'react-native';
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
    <Animated.ScrollView onScroll={dockScrollHandler} scrollEventThrottle={16} style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {selectedSubject ? (
        <>
          <Pressable style={styles.backButton} onPress={() => { setSelectedSubject(null); setSearchQuery(''); }}>
            <Ionicons name="chevron-back" size={17} color={colors.primary} />
            <LocalizedText style={styles.backText}>Barcha fanlar</LocalizedText>
          </Pressable>
          <View style={styles.detailHeader}>
            <View style={[styles.largeIconBox, { backgroundColor: selectedSubject.color + '20' }]}>
              <LocalizedText style={[styles.largeIcon, { color: selectedSubject.color }]}>{selectedSubject.icon}</LocalizedText>
            </View>
            <View style={styles.detailCopy}>
              <LocalizedText style={styles.eyebrow}>QUIZ ARENA  /  FANLAR</LocalizedText>
              <LocalizedText style={styles.title}>{selectedSubject.name}</LocalizedText>
              <LocalizedText style={styles.subtitle}>{selectedSubject.description}</LocalizedText>
            </View>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={colors.textMuted} />
            <LocalizedTextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Mavzularni qidiring..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" autoCorrect={false} />
            {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>}
          </View>
          <View style={styles.sectionHeader}>
            <LocalizedText style={styles.sectionTitle}>BARCHA MAVZULAR</LocalizedText>
            <LocalizedText style={styles.sectionCount}>{filteredTopics.length} ta</LocalizedText>
          </View>
          <View style={styles.topicList}>
            {filteredTopics.map((topic) => {
              const index = selectedSubject.topics.findIndex((item) => item.id === topic.id);
              return (
                <Pressable key={topic.id} style={({ pressed }) => [styles.topicCard, pressed && styles.pressed]} onPress={() => onTopicSelect?.(selectedSubject, topic)}>
                  <View style={styles.topicNumber}><LocalizedText style={styles.numberText}>{String(index + 1).padStart(2, '0')}</LocalizedText></View>
                  <View style={styles.topicInfo}>
                    <LocalizedText style={styles.topicName}>{topic.name}</LocalizedText>
                    <LocalizedText style={styles.topicDescription}>{topic.description}</LocalizedText>
                    <LocalizedText style={styles.questionCount}>{topic.questionCount} ta savol</LocalizedText>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
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
          <View style={styles.sectionHeader}>
            <LocalizedText style={styles.sectionTitle}>BARCHA FANLAR</LocalizedText>
            <LocalizedText style={styles.sectionCount}>{filteredSubjects.length} ta</LocalizedText>
          </View>
          <View style={styles.subjectGrid}>
            {filteredSubjects.map((subject) => (
              <Pressable key={subject.id} style={({ pressed }) => [styles.subjectCard, pressed && styles.pressed]} onPress={() => { setSelectedSubject(subject); setSearchQuery(''); }}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.subjectIcon, { backgroundColor: subject.color + '20' }]}>
                    <LocalizedText style={[styles.subjectGlyph, { color: subject.color }]}>{subject.icon}</LocalizedText>
                  </View>
                  <Ionicons name="arrow-forward" size={15} color={colors.textMuted} />
                </View>
                <LocalizedText style={styles.subjectName} numberOfLines={2}>{subject.name}</LocalizedText>
                <LocalizedText style={styles.subjectDescription} numberOfLines={2}>{subject.description}</LocalizedText>
                <LocalizedText style={styles.subjectCount}>{subject.topics.length} ta mavzu</LocalizedText>
              </Pressable>
            ))}
          </View>
          {filteredSubjects.length === 0 && <LocalizedText style={styles.emptyText}>Bu qidiruv bo‘yicha fan topilmadi.</LocalizedText>}
          <LocalizedText style={styles.footerHint}>Fanni tanlang va o‘rganishni boshlang.</LocalizedText>
        </>
      )}
    </Animated.ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 136 },
    header: { marginTop: 8, marginBottom: 19 },
    eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 },
    title: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7 },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7 },
    searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.surface, marginBottom: 21 },
    searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, paddingVertical: 10 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
    sectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    sectionCount: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
    subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 13 },
    subjectCard: { width: '48.5%', minHeight: 158, borderRadius: 22, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.surface, padding: 14 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    subjectIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    subjectGlyph: { fontSize: 22, fontWeight: '800' },
    subjectName: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 4 },
    subjectDescription: { color: colors.textMuted, fontSize: 10, lineHeight: 14, minHeight: 28 },
    subjectCount: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 9 },
    footerHint: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 18, marginBottom: 10 },
    backButton: { minHeight: 38, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 13, paddingRight: 18 },
    backText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 19 },
    largeIconBox: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    largeIcon: { fontSize: 31, fontWeight: '800' },
    detailCopy: { flex: 1, minWidth: 0 },
    topicList: { gap: 8 },
    topicCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.glassBorder, gap: 11 },
    topicNumber: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    numberText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
    topicInfo: { flex: 1, minWidth: 0 },
    topicName: { color: colors.text, fontSize: 12, fontWeight: '800' },
    topicDescription: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
    questionCount: { color: colors.primary, fontSize: 10, fontWeight: '700', marginTop: 5 },
    emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 20 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  });
}
