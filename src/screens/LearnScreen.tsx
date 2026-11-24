
import { useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';

import { subjects } from '../data/subjects';
import type { Subject, Topic } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface LearnScreenProps {
  onTopicSelect?: (subject: Subject, topic: Topic) => void;
  dockStretch?: SharedValue<number>;
}

export default function LearnScreen({ onTopicSelect, dockStretch }: LearnScreenProps) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
  const lastDockScrollY = useSharedValue(0);
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

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  return (
    <Animated.ScrollView
      onScroll={dockScrollHandler}
      scrollEventThrottle={16}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {selectedSubject ? (
        <>
          <Pressable
            style={styles.backButton}
            onPress={() => setSelectedSubject(null)}
          >
            <Text style={styles.backText}>‹  Barcha fanlar</Text>
          </Pressable>

          <View style={styles.detailHeader}>
            <View
              style={[
                styles.largeIconBox,
                { backgroundColor: `${selectedSubject.color}20` },
              ]}
            >
              <Text style={[styles.largeIcon, { color: selectedSubject.color }]}>
                {selectedSubject.icon}
              </Text>
            </View>

            <Text style={styles.title}>{selectedSubject.name}</Text>
            <Text style={styles.subtitle}>{selectedSubject.description}</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mavzular</Text>
            <Text style={styles.sectionCount}>
              {selectedSubject.topics.length} ta mavzu
            </Text>
          </View>

          {selectedSubject.topics.map((topic, index) => (
            <Pressable
              key={topic.id}
              style={({ pressed }) => [
                styles.topicCard,
                pressed && styles.pressed,
              ]}
              onPress={() => onTopicSelect?.(selectedSubject, topic)}
            >
              <View style={styles.topicNumber}>
                <Text style={styles.numberText}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
              </View>

              <View style={styles.topicInfo}>
                <Text style={styles.topicName}>{topic.name}</Text>
                <Text style={styles.topicDescription}>
                  {topic.description}
                </Text>
                <Text style={styles.questionCount}>
                  {topic.questionCount} ta savol
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>QUIZ ARENA • TA'LIM</Text>
            <Text style={styles.title}>Bilimingizni oshiring</Text>
            <Text style={styles.subtitle}>
              Fanni tanlang va mavzular bo‘yicha bilimlaringizni mustahkamlang.
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryNumber}>{subjects.length}</Text>
              <Text style={styles.summaryLabel}>ta fan mavjud</Text>
            </View>
            <View style={styles.summaryIcon}>
              <Text style={styles.summaryIconText}>✦</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Barcha fanlar</Text>
            <Text style={styles.sectionCount}>{subjects.length} ta</Text>
          </View>

          <View style={styles.subjectGrid}>
            {subjects.map((subject) => (
              <Pressable
                key={subject.id}
                style={({ pressed }) => [
                  styles.subjectCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedSubject(subject)}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: `${subject.color}20` },
                  ]}
                >
                  <Text style={[styles.subjectIcon, { color: subject.color }]}>
                    {subject.icon}
                  </Text>
                </View>

                <Text style={styles.subjectName} numberOfLines={1}>
                  {subject.name}
                </Text>

                <Text style={styles.subjectTopics}>
                  {subject.topics.length} ta mavzu
                </Text>

                <View style={styles.cardArrow}>
                  <Text style={styles.arrow}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Animated.ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 128,
  },
  header: {
    marginTop: 10,
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    padding: 17,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryNumber: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconText: {
    color: colors.primary,
    fontSize: 27,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  subjectCard: {
    width: '48%',
    minHeight: 154,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  subjectIcon: {
    fontSize: 27,
    fontWeight: '700',
  },
  subjectName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  subjectTopics: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  cardArrow: {
    position: 'absolute',
    right: 13,
    top: 13,
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 25,
    fontWeight: '400',
  },
  backButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingRight: 18,
    marginBottom: 16,
  },
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  detailHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  largeIconBox: {
    width: 78,
    height: 78,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  largeIcon: {
    fontSize: 42,
    fontWeight: '700',
  },
  topicCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicNumber: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  numberText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  topicDescription: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  questionCount: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 7,
  },
  pressed: {
    opacity: 0.72,
  },
  });
}
