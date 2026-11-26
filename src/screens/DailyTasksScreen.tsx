import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LocalizedText } from '../i18n/LocalizedText';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useTheme } from '../theme/ThemeContext';
import { claimDailyTask, getDailyTasks, type DailyTask } from '../services/dailyTasksService';

type Props = { onBack: () => void };

export default function DailyTasksScreen({ onBack }: Props) {
  const { refreshUser } = useAuth();
  const { theme } = useAppSettings();
  const { tokens } = useTheme();
  const isDark = theme === 'dark';
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await getDailyTasks();
      setTasks(result.tasks);
      setDate(result.date);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vazifalarni yuklab bo‘lmadi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (date && today !== date) void load();
    }, 60_000);
    return () => clearInterval(timer);
  }, [load, date]);

  const claim = async (task: DailyTask) => {
    if (!task.completed || task.claimed || claimingId) return;
    setClaimingId(task.id);
    try {
      await claimDailyTask(task.id);
      await Promise.all([load(), refreshUser()]);
      Alert.alert('Mukofot olindi!', `Hisobingizga ${task.reward} ZC qo‘shildi.`);
    } catch (e) {
      Alert.alert('Xatolik', e instanceof Error ? e.message : 'Mukofotni olish amalga oshmadi.');
    } finally {
      setClaimingId(null);
    }
  };

  const completed = tasks.filter((task) => task.completed).length;
  const claimed = tasks.filter((task) => task.claimed).length;
  const totalProgress = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + Math.min(1, task.progress / Math.max(1, task.target)), 0) / tasks.length * 100) : 0;
  const C = { background: tokens.colors.background, surface: tokens.colors.surface, border: tokens.colors.glassBorder, text: tokens.colors.text, muted: tokens.colors.textMuted, primary: tokens.colors.primary };

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Pressable onPress={onBack} style={[styles.backButton, { backgroundColor: C.surface, borderColor: C.border }]} accessibilityRole="button" accessibilityLabel="Orqaga">
          <Ionicons name="arrow-back" size={21} color={C.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <LocalizedText style={[styles.eyebrow, { color: C.muted }]}>ZELQEN CORE</LocalizedText>
          <LocalizedText style={[styles.title, { color: C.text }]}>Kunlik vazifalar</LocalizedText>
        </View>
        <View style={styles.todayPill}><LocalizedText style={styles.todayText}>BUGUN</LocalizedText></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="flash" size={25} color="#FFFFFF" /></View>
          <LocalizedText style={styles.heroTitle}>Bugungi maqsadlaringiz</LocalizedText>
          <LocalizedText style={styles.heroDescription}>Vazifalarni bajaring, tajriba orttiring va ZC mukofotlarini qo‘lga kiriting.</LocalizedText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}><LocalizedText style={styles.summaryValue}>{completed}/{tasks.length}</LocalizedText><LocalizedText style={styles.summaryLabel}>Bajarildi</LocalizedText></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}><LocalizedText style={styles.summaryValue}>{claimed}</LocalizedText><LocalizedText style={styles.summaryLabel}>Mukofot olindi</LocalizedText></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}><LocalizedText style={styles.summaryValue}>{totalProgress}%</LocalizedText><LocalizedText style={styles.summaryLabel}>Umumiy progress</LocalizedText></View>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${totalProgress}%` }]} /></View>
        </Animated.View>

        <View style={styles.sectionHeading}>
          <LocalizedText style={[styles.sectionTitle, { color: C.text }]}>Vazifalar ro‘yxati</LocalizedText>
          <LocalizedText style={[styles.sectionMeta, { color: C.muted }]}>{date || 'Bugun'}</LocalizedText>
        </View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator color={C.primary} /><LocalizedText style={[styles.stateText, { color: C.muted }]}>Vazifalar yuklanmoqda...</LocalizedText></View> :
          error ? <View style={styles.stateBox}><Ionicons name="cloud-offline-outline" size={25} color={C.muted} /><LocalizedText style={[styles.stateText, { color: C.muted }]}>{error}</LocalizedText><Pressable style={styles.retry} onPress={() => { setLoading(true); void load(); }}><LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText></Pressable></View> :
          tasks.length === 0 ? <View style={styles.stateBox}><Ionicons name="checkmark-done-circle-outline" size={28} color={C.muted} /><LocalizedText style={[styles.stateText, { color: C.muted }]}>Hozircha kunlik vazifalar mavjud emas.</LocalizedText></View> :
          tasks.map((task, index) => {
            const progress = Math.min(100, Math.round(task.progress / Math.max(1, task.target) * 100));
            const ready = task.completed && !task.claimed;
            return <Animated.View key={task.id} entering={FadeInDown.delay(index * 75).duration(350)} style={[styles.taskCard, { backgroundColor: C.surface, borderColor: task.completed ? 'rgba(39,185,138,0.42)' : C.border }]}>
              <View style={styles.taskTop}>
                <View style={[styles.check, task.completed && styles.checkDone]}><Ionicons name={task.completed ? 'checkmark' : 'ellipse-outline'} size={17} color={task.completed ? '#FFFFFF' : C.muted} /></View>
                <View style={styles.taskCopy}><LocalizedText style={[styles.taskTitle, { color: C.text }]}>{task.title}</LocalizedText><LocalizedText style={[styles.taskDescription, { color: C.muted }]}>{task.description}</LocalizedText></View>
                <View style={styles.reward}><LocalizedText style={styles.rewardText}>+{task.reward} ZC</LocalizedText></View>
              </View>
              <View style={styles.progressRow}><View style={[styles.taskTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : '#E9E7F2' }]}><View style={[styles.taskFill, { width: `${progress}%` }]} /></View><LocalizedText style={[styles.progressText, { color: C.muted }]}>{Math.min(task.progress, task.target)}/{task.target}</LocalizedText></View>
              {ready ? <Pressable disabled={claimingId !== null} onPress={() => void claim(task)} style={[styles.claimButton, claimingId !== null && styles.disabled]}><Ionicons name="gift-outline" size={16} color="#FFFFFF" /><LocalizedText style={styles.claimText}>{claimingId === task.id ? 'Olinmoqda...' : 'Mukofotni olish'}</LocalizedText></Pressable> : task.claimed ? <View style={styles.claimed}><Ionicons name="checkmark-circle" size={16} color="#27B98A" /><LocalizedText style={styles.claimedText}>Mukofot olindi</LocalizedText></View> : <LocalizedText style={[styles.hint, { color: C.muted }]}>Vazifani yakunlang va mukofotni oling</LocalizedText>}
            </Animated.View>;
          })
        }

        <View style={[styles.footer, { borderColor: C.border, backgroundColor: C.surface }]}><Ionicons name="refresh-circle-outline" size={19} color={C.muted} /><LocalizedText style={[styles.footerText, { color: C.muted }]}>Vazifalar Toshkent vaqti bilan har kuni 00:00 da yangilanadi.</LocalizedText></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12, borderBottomWidth: 1 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  title: { fontSize: 19, fontWeight: '900' },
  todayPill: { backgroundColor: 'rgba(39,185,138,0.16)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  todayText: { color: '#27B98A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  content: { padding: 20, paddingBottom: 48 },
  hero: { padding: 22, borderRadius: 26, backgroundColor: '#292044', gap: 10, overflow: 'hidden' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#27B98A', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 3 },
  heroDescription: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  summaryLabel: { color: 'rgba(255,255,255,0.66)', fontSize: 9, fontWeight: '700', textAlign: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.16)' },
  progressTrack: { height: 7, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 9, overflow: 'hidden', marginTop: 5 },
  progressFill: { height: '100%', backgroundColor: '#27B98A', borderRadius: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionMeta: { fontSize: 10, fontWeight: '700' },
  stateBox: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderRadius: 18 },
  stateText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retry: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 12, backgroundColor: '#7657E8' },
  retryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  taskCard: { padding: 15, borderRadius: 21, borderWidth: 1, marginBottom: 13, gap: 12 },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(140,130,170,0.4)', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: '#27B98A', borderColor: '#27B98A' },
  taskCopy: { flex: 1, gap: 4 },
  taskTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  taskDescription: { fontSize: 10, lineHeight: 15 },
  reward: { backgroundColor: 'rgba(214,182,106,0.15)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  rewardText: { color: '#D6B66A', fontSize: 10, fontWeight: '900' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  taskTrack: { flex: 1, height: 6, borderRadius: 8, overflow: 'hidden' },
  taskFill: { height: '100%', borderRadius: 8, backgroundColor: '#27B98A' },
  progressText: { fontSize: 10, fontWeight: '800', minWidth: 34, textAlign: 'right' },
  claimButton: { minHeight: 48, borderRadius: 15, backgroundColor: '#7657E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  claimText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  claimed: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  claimedText: { color: '#27B98A', fontSize: 11, fontWeight: '800' },
  hint: { fontSize: 10, paddingTop: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 8 },
  footerText: { flex: 1, fontSize: 10, lineHeight: 15 },
});
