import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

export default function CommunityClipVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = true; instance.muted = false; });
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const playing = player.addListener('playingChange', ({ isPlaying: next }) => setIsPlaying(next));
    const status = player.addListener('statusChange', ({ status: next }) => setHasError(next === 'error'));
    return () => { playing.remove(); status.remove(); };
  }, [player]);
  const toggle = () => {
    if (hasError) { void Linking.openURL(uri).catch(() => undefined); return; }
    if (isPlaying) player.pause(); else player.play();
  };
  return (
    <View style={styles.frame}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} playsInline />
      {!isPlaying && !hasError && <Pressable accessibilityRole="button" accessibilityLabel="Videoni ijro etish" onPress={toggle} style={styles.playOverlay}>
        <View style={styles.playButton}><Ionicons name="play" size={29} color="#FFFFFF" /></View>
        <Text style={styles.playHint}>Videoni ko‘rish uchun bosing</Text>
      </Pressable>}
      {hasError && <View style={styles.errorOverlay}>
        <Ionicons name="alert-circle-outline" size={30} color="#FFFFFF" />
        <Text style={styles.errorTitle}>Bu video qurilmada ochilmadi</Text>
        <Text style={styles.errorHint}>MP4 (H.264) formatidagi video yaxshi ishlaydi.</Text>
        <Pressable onPress={toggle} style={styles.externalButton}><Ionicons name="open-outline" size={16} color="#FFFFFF" /><Text style={styles.externalButtonText}>Boshqa playerda ochish</Text></Pressable>
      </View>}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 9 / 16, maxHeight: 620, overflow: 'hidden', borderRadius: 22, backgroundColor: '#080A12' },
  playOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  playButton: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', paddingLeft: 4, backgroundColor: 'rgba(104,79,220,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  playHint: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginTop: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },
  errorOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(8,10,18,0.94)', gap: 9 },
  errorTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  errorHint: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'center', lineHeight: 17 },
  externalButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#684FDC', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 5 },
  externalButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
