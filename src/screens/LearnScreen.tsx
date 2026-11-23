
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';

import { subjects } from '../data/subjects';
import type { Subject, Topic } from '../types';

interface LearnScreenProps {
  onTopicSelect?: (subject: Subject, topic: Topic) => void;
}

export default function LearnScreen({ onTopicSelect }: LearnScreenProps) {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  return (
    <ScrollView
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080D1D',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 12,
    marginBottom: 22,
  },
  eyebrow: {
    color: '#8B7CFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: '#929BB5',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: '#171F39',
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#293354',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#A5AEC8',
    fontSize: 13,
    marginTop: 2,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#8B7CFF25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconText: {
    color: '#A99EFF',
    fontSize: 27,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  sectionCount: {
    color: '#818BA8',
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
    minHeight: 158,
    backgroundColor: '#151C32',
    borderRadius: 20,
    padding: 15,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: '#252E49',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  subjectIcon: {
    fontSize: 27,
    fontWeight: '700',
  },
  subjectName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  subjectTopics: {
    color: '#8994B1',
    fontSize: 12,
    marginTop: 6,
  },
  cardArrow: {
    position: 'absolute',
    right: 13,
    top: 13,
  },
  arrow: {
    color: '#7783A3',
    fontSize: 25,
    fontWeight: '400',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingRight: 16,
    marginBottom: 20,
  },
  backText: {
    color: '#A99EFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151C32',
    borderRadius: 17,
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#252E49',
  },
  topicNumber: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#252D49',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  numberText: {
    color: '#A99EFF',
    fontSize: 13,
    fontWeight: '800',
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  topicDescription: {
    color: '#929BB5',
    fontSize: 12,
    marginTop: 4,
  },
  questionCount: {
    color: '#8B7CFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 7,
  },
  pressed: {
    opacity: 0.72,
  },
});
