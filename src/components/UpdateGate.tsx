import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../config/api';

type AppReleaseInfo = {
  latestVersion: string;
  minSupportedVersion: string;
  androidUrl: string;
  releaseNotes?: string;
};

const compareVersions = (left: string, right: string) => {
  const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

export default function UpdateGate() {
  const [release, setRelease] = useState<AppReleaseInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const installedVersion = Constants.expoConfig?.version || '0.0.0';

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/app/version`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const data = (await response.json()) as AppReleaseInfo;
        if (!data.latestVersion || !data.minSupportedVersion || !data.androidUrl) return;
        if (!active) return;
        setRelease(data);
        setVisible(compareVersions(installedVersion, data.latestVersion) < 0);
      } catch {
        // Version checking is best-effort; a network outage must not block the app.
      } finally {
        if (active) setChecking(false);
      }
    };
    void check();
    return () => { active = false; };
  }, [installedVersion]);

  if (checking || !release || !visible) return null;
  const required = compareVersions(installedVersion, release.minSupportedVersion) < 0;

  const openUpdate = async () => {
    try {
      await Linking.openURL(release.androidUrl);
    } catch {
      // Keep the update screen visible if the external page cannot be opened.
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!required) setVisible(false); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}><Text style={styles.iconText}>↻</Text></View>
          <Text style={styles.kicker}>QUIZ ARENA • YANGILANISH</Text>
          <Text style={styles.title}>Yangi versiya mavjud</Text>
          <Text style={styles.description}>
            Ilovaning yangi {release.latestVersion} versiyasi tayyor. Davom etish uchun yangilanishni yuklab oling.
          </Text>
          {release.releaseNotes ? <Text style={styles.notes}>{release.releaseNotes}</Text> : null}
          <Pressable style={styles.primary} onPress={() => { void openUpdate(); }}>
            <Text style={styles.primaryText}>Yangilash sahifasiga o‘tish</Text>
          </Pressable>
          {!required ? (
            <Pressable style={styles.secondary} onPress={() => setVisible(false)}>
              <Text style={styles.secondaryText}>Keyinroq</Text>
            </Pressable>
          ) : (
            <Text style={styles.required}>Bu yangilanish majburiy. Eski versiyada davom etib bo‘lmaydi.</Text>
          )}
          <Text style={styles.current}>O‘rnatilgan versiya: {installedVersion}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,5,14,0.88)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 420, borderRadius: 28, padding: 24, backgroundColor: '#171426', borderWidth: 1, borderColor: 'rgba(169,143,255,0.32)', alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(151,111,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  iconText: { color: '#B9A4FF', fontSize: 38, fontWeight: '700' },
  kicker: { color: '#A995FF', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  description: { color: '#C5C0D5', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  notes: { color: '#AFA8C4', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 12 },
  primary: { width: '100%', minHeight: 52, borderRadius: 16, backgroundColor: '#8B68F5', alignItems: 'center', justifyContent: 'center', marginTop: 22, paddingHorizontal: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondary: { padding: 14 },
  secondaryText: { color: '#B9A4FF', fontSize: 13, fontWeight: '800' },
  required: { color: '#F2B7B7', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  current: { color: '#777188', fontSize: 10, marginTop: 10 },
});
