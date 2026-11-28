import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { Socket } from 'socket.io-client';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { uploadCommunityMedia } from '../services/communityService';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import { communityTokens, type CommunityColors } from '../theme/communityTokens';
import {
  createDirectSocket, getDirectConversations, getDirectMessages, markDirectRead, editDirectMessage, deleteDirectMessage, getDirectMessageHistory,
  sendDirectMessage, sendDirectVoiceMessage, getDirectAttachmentUrl, sendDirectAttachmentMessage, startDirectConversation,
  type DirectConversation, type DirectMessage, type DirectPerson,
} from '../services/directMessagesService';

interface Props { onBack: () => void; initialUserId?: string | null; }
function initials(name: string) { return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'Z'; }
function timeLabel(value: string) { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function conversationTime(value: string) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return timeLabel(value);
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function VoiceMessageBubble({ message, conversationId, isMine, colors, styles }: { message: DirectMessage; conversationId: string; isMine: boolean; colors: CommunityColors; styles: ReturnType<typeof makeStyles> }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loading, setLoading] = useState(false);
  const total = message.durationSeconds || status.duration || 0;
  const current = status.currentTime || 0;
  const progress = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  const toggle = async () => {
    if (status.playing) { player.pause(); return; }
    if (loading) return;
    setLoading(true);
    try {
      const playback = await getDirectAttachmentUrl(conversationId, message.id);
      player.replace(playback.url);
      player.play();
    } catch (error) {
      showLocalizedAlert('Ovozli xabar', error instanceof Error ? error.message : 'Ovozli xabarni ochib bo‘lmadi');
    } finally { setLoading(false); }
  };
  return (
    <View style={styles.voiceMessage}>
      <Pressable onPress={() => void toggle()} disabled={loading} style={[styles.voicePlay, isMine && styles.voicePlayMine]} accessibilityRole="button" accessibilityLabel={status.playing ? 'Ovozli xabarni to‘xtatish' : 'Ovozli xabarni tinglash'}>
        <Ionicons name={loading ? 'hourglass' : status.playing ? 'pause' : 'play'} size={17} color={isMine ? '#FFFFFF' : colors.primary} />
      </Pressable>
      <View style={styles.voiceTrackWrap}>
        <View style={styles.voiceTrack}><View style={[styles.voiceProgress, { width: `${progress}%` }]} /></View>
        <LocalizedText style={[styles.voiceDuration, isMine && styles.myMessageTime]}>{Math.floor(((current > 0 && !status.didJustFinish) ? current : total) / 60)}:{String(Math.floor(((current > 0 && !status.didJustFinish) ? current : total) % 60)).padStart(2, '0')}</LocalizedText>
      </View>
      <Ionicons name="mic" size={17} color={isMine ? 'rgba(255,255,255,0.85)' : colors.primary} />
    </View>
  );
}

function newDirectMessageKey() {
  return `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function AttachmentBubble({ message, conversationId, isMine, colors, styles }: { message: DirectMessage; conversationId: string; isMine: boolean; colors: CommunityColors; styles: ReturnType<typeof makeStyles> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = Boolean(message.mediaType?.startsWith('image/'));
  useEffect(() => {
    let alive = true;
    getDirectAttachmentUrl(conversationId, message.id).then((result) => { if (alive) setUrl(result.url); })
      .catch((error) => { if (alive) showLocalizedAlert('Faylni ochib bo‘lmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [conversationId, message.id]);
  const open = async () => {
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { showLocalizedAlert('Fayl', 'Faylni ochish uchun mos ilova topilmadi.'); }
  };
  if (isImage) return (
    <Pressable onPress={() => void open()} disabled={!url} accessibilityRole="button" accessibilityLabel="Rasmni to‘liq ochish" style={styles.imageAttachment}>
      {url ? <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" /> : <View style={styles.attachmentLoading}><ActivityIndicator color={isMine ? '#FFFFFF' : colors.primary} /></View>}
      <LocalizedText style={[styles.attachmentName, isMine && styles.myMessageTime]} numberOfLines={1}>{message.content || 'Rasm'}</LocalizedText>
    </Pressable>
  );
  const extension = message.content.includes('.') ? message.content.split('.').pop()?.toUpperCase() : 'FILE';
  return (
    <Pressable onPress={() => void open()} disabled={!url} style={styles.documentAttachment} accessibilityRole="button" accessibilityLabel="Hujjatni ochish">
      <View style={[styles.documentIcon, isMine && styles.documentIconMine]}><Ionicons name={message.mediaType === 'application/pdf' ? 'document-text' : 'document-outline'} size={22} color={isMine ? '#FFFFFF' : colors.primary} /></View>
      <View style={styles.documentCopy}>
        <LocalizedText style={[styles.attachmentName, isMine && styles.myMessageText]} numberOfLines={2}>{message.content || 'Hujjat'}</LocalizedText>
        <LocalizedText style={[styles.documentType, isMine && styles.myMessageTime]}>{loading ? 'Yuklanmoqda...' : url ? `${extension || 'FILE'} · Ochish` : 'Ochib bo‘lmadi'}</LocalizedText>
      </View>
      <Ionicons name={loading ? 'hourglass-outline' : 'open-outline'} size={17} color={isMine ? '#FFFFFF' : colors.primary} />
    </Pressable>
  );
}

export default function DirectMessagesScreen({ onBack, initialUserId }: Props) {
  const { mode, isDark } = useTheme();
  const c = communityTokens[mode].colors;
  const styles = makeStyles(c, isDark);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [active, setActive] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recordingSession, setRecordingSession] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const socketRef = useRef<Socket | null>(null);
  const messageListRef = useRef<FlatList<DirectMessage>>(null);
  const messageRequestRef = useRef(0);
  const realtimeMessageVersionRef = useRef(0);
  const recordingConversationRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  const activeConversationRef = useRef<DirectConversation | null>(null);
  const pendingTextAttemptRef = useRef<{ conversationId: string; content: string; key: string } | null>(null);
  const sendLockRef = useRef(false);
  const mediaSendLockRef = useRef(false);

  useEffect(() => { activeConversationRef.current = active; }, [active]);

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError(false);
    try { setConversations(await getDirectConversations()); }
    catch { setLoadError(true); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, requestId = ++messageRequestRef.current) => {
    const observedRealtimeVersion = realtimeMessageVersionRef.current;
    try {
      const rows = await getDirectMessages(conversationId);
      if (requestId !== messageRequestRef.current) return;
      // If a socket event arrived while this snapshot was in flight, fetch again before
      // applying it so an older response cannot overwrite a new message or moderation event.
      if (observedRealtimeVersion !== realtimeMessageVersionRef.current) {
        void loadMessages(conversationId, requestId);
        return;
      }
      setMessages((current) => [
        ...current.filter((item) => item.conversationId !== conversationId),
        ...rows,
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      // The server snapshot is authoritative for this conversation: messages deleted
      // for this participant while offline must not be reintroduced from stale local state.
      try {
        await markDirectRead(conversationId);
        if (requestId === messageRequestRef.current) {
          setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
        }
      } catch { /* Message history is still usable when the read receipt endpoint is offline. */ }
    } catch (error) {
      if (requestId === messageRequestRef.current) showLocalizedAlert('Chat', error instanceof Error ? error.message : 'Xabarlar yuklanmadi');
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    let alive = true;
    createDirectSocket().then((client) => {
      if (!alive) { client.disconnect(); return; }
      socketRef.current = client;
      client.on('connect', () => {
        void loadConversations(true);
        const current = activeConversationRef.current;
        if (current) void loadMessages(current.id);
      });
      client.on('direct:message', (message: DirectMessage) => {
        realtimeMessageVersionRef.current += 1;
        void loadConversations(true);
        setActive((current) => {
          if (current?.id === message.conversationId) {
            setMessages((rows) => rows.some((row) => row.id === message.id) ? rows : [...rows, message]);
            if (stickToBottomRef.current) requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
            if (!message.isMine) {
              void markDirectRead(message.conversationId).then(() => {
                setConversations((items) => items.map((item) => item.id === message.conversationId ? { ...item, unreadCount: 0 } : item));
              }).catch(() => undefined);
            }
          }
          return current;
        });
      });
      client.on('direct:message-updated', (message: DirectMessage) => {
        realtimeMessageVersionRef.current += 1;
        setMessages((rows) => rows.map((row) => row.id === message.id ? message : row));
        void loadConversations(true);
      });
      client.on('direct:message-deleted', (message: DirectMessage) => {
        realtimeMessageVersionRef.current += 1;
        setMessages((rows) => message.deletedForMe ? rows.filter((row) => row.id !== message.id) : rows.map((row) => row.id === message.id ? message : row));
        void loadConversations(true);
      });
      client.on('direct:read', (event: { conversationId: string }) => {
        void loadConversations(true);
        setMessages((rows) => rows.map((row) => row.conversationId === event.conversationId && row.isMine ? { ...row, readAt: new Date().toISOString() } : row));
      });
    }).catch(() => undefined);
    return () => { alive = false; socketRef.current?.disconnect(); socketRef.current = null; };
  // Socket is created once per screen mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const returnedToForeground = Boolean(previousState && previousState.match(/inactive|background/)) && nextState === 'active';
      previousState = nextState;
      if (!returnedToForeground) return;
      void loadConversations(true);
      const current = activeConversationRef.current;
      if (current) void loadMessages(current.id);
    });
    return () => subscription.remove();
  }, [loadConversations, loadMessages]);

  useEffect(() => {
    // Active conversations are updated through the authenticated Socket.IO channel.
    // Poll only the conversation list, and only while the list is visible.
    if (active) return;
    const timer = setInterval(() => {
      void loadConversations(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, [active?.id, loadConversations]);

  useEffect(() => {
    if (!initialUserId) return;
    let alive = true;
    setChatLoading(true);
    startDirectConversation(initialUserId).then((conversation) => {
      if (!alive) return;
      setActive(conversation);
      setConversations((rows) => [conversation, ...rows.filter((row) => row.id !== conversation.id)]);
    }).catch((error) => showLocalizedAlert('Chat', error instanceof Error ? error.message : 'Suhbat ochilmadi'))
      .finally(() => { if (alive) setChatLoading(false); });
    return () => { alive = false; };
  }, [initialUserId]);

  useEffect(() => {
    // Clear the previous conversation immediately and ignore late responses from older requests.
    const requestId = ++messageRequestRef.current;
    setEditingMessageId(null);
    setDraft('');
    setMessages([]);
    stickToBottomRef.current = true;
    if (!active) { setChatLoading(false); return; }
    setChatLoading(true);
    void loadMessages(active.id, requestId).finally(() => {
      if (requestId === messageRequestRef.current) setChatLoading(false);
    });
  }, [active?.id, loadMessages]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) =>
      [item.otherUser.displayName, item.otherUser.username, item.lastMessage?.content || '']
        .some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [conversations, search]);

  const openConversation = (conversation: DirectConversation) => setActive(conversation);
  const send = async () => {
    const text = draft.trim();
    const conversationId = active?.id;
    if (!conversationId || !text || sending || sendLockRef.current) return;
    if (editingMessageId) {
      sendLockRef.current = true; setSending(true);
      try {
        const updated = await editDirectMessage(conversationId, editingMessageId, text);
        setMessages((rows) => rows.map((row) => row.id === updated.id ? updated : row));
        if (active?.id === conversationId) { setDraft(''); setEditingMessageId(null); }
        void loadConversations(true);
      } catch (error) { showLocalizedAlert('Xabar tahrirlanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
      finally { sendLockRef.current = false; setSending(false); }
      return;
    }
    const pending = pendingTextAttemptRef.current;
    const clientMessageId = pending?.conversationId === conversationId && pending.content === text ? pending.key : newDirectMessageKey();
    pendingTextAttemptRef.current = { conversationId, content: text, key: clientMessageId };
    sendLockRef.current = true;
    setSending(true);
    try {
      const message = await sendDirectMessage(conversationId, text, clientMessageId);
      if (pendingTextAttemptRef.current?.key === clientMessageId) pendingTextAttemptRef.current = null;
      // A slow send must never leak a message into a different conversation.
      if (active?.id === conversationId) {
        setMessages((rows) => rows.some((row) => row.id === message.id) ? rows : [...rows, message]);
        requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
        setDraft((current) => current === text ? '' : current);
      }
      void loadConversations(true);
    } catch (error) {
      if (active?.id === conversationId) showLocalizedAlert('Xabar yuborilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
    } finally { sendLockRef.current = false; setSending(false); }
  };

  const showMessageHistory = async (message: DirectMessage) => {
    if (!active || !message.isMine) return;
    try {
      const history = await getDirectMessageHistory(active.id, message.id);
      if (!history.entries.length) { showLocalizedAlert('Xabar tarixi', 'Bu xabarda avvalgi tahrirlar yo‘q.'); return; }
      const lines = history.entries.map((entry, index) => `${index + 1}. ${entry.action === 'edited' ? 'Avvalgi matn' : entry.action === 'deleted_for_everyone' ? 'Hamma uchun o‘chirilgan matn' : 'O‘chirish hodisasi'}\n${entry.content || 'Matn saqlanmagan'}\n${new Date(entry.at).toLocaleString()}`);
      showLocalizedAlert('Xabar tarixi', lines.join('\n\n'));
    } catch (error) { showLocalizedAlert('Xabar tarixi', error instanceof Error ? error.message : 'Tarixni yuklab bo‘lmadi'); }
  };

  const removeMessage = async (message: DirectMessage, scope: 'me' | 'everyone') => {
    if (!active) return;
    try {
      const result = await deleteDirectMessage(active.id, message.id, scope);
      if (scope === 'me') setMessages((rows) => rows.filter((row) => row.id !== message.id));
      else setMessages((rows) => rows.map((row) => row.id === result.id ? result : row));
      void loadConversations(true);
    } catch (error) { showLocalizedAlert('Xabar o‘chirilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
  };

  const showMessageActions = (message: DirectMessage) => {
    const canDeleteEveryone = message.isMine && Date.now() - new Date(message.createdAt).getTime() <= 60 * 60 * 1000;
    if (message.isDeleted) {
      const options = [] as Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }>;
      if (message.isMine) options.push({ text: 'Xabar tarixini ko‘rish', onPress: () => void showMessageHistory(message) });
      options.push({ text: 'Faqat mendan olib tashlash', style: 'destructive', onPress: () => void removeMessage(message, 'me') });
      options.push({ text: 'Yopish', style: 'cancel' });
      Alert.alert('O‘chirilgan xabar', 'Xabar mazmuni chatda ko‘rsatilmaydi.', options);
      return;
    }
    const options = [] as Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }>;
    if (message.isMine && !message.mediaType && Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000) {
      options.push({ text: 'Tahrirlash', onPress: () => { setEditingMessageId(message.id); setDraft(message.content); } });
    }
    options.push({ text: 'O‘chirish', style: 'destructive', onPress: () => {
      const deleteOptions: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
        { text: 'Faqat mendan', style: 'destructive', onPress: () => void removeMessage(message, 'me') },
      ];
      if (canDeleteEveryone) deleteOptions.push({ text: 'Hamma uchun', style: 'destructive', onPress: () => void removeMessage(message, 'everyone') });
      deleteOptions.push({ text: 'Bekor qilish', style: 'cancel' });
      Alert.alert('Xabarni o‘chirish', canDeleteEveryone ? 'Xabarni faqat sizdan yoki ikkala ishtirokchidan ham o‘chirish mumkin.' : 'Bu xabar faqat sizning chat ro‘yxatingizdan olib tashlanadi.', deleteOptions);
    } });
    if (message.isMine) options.push({ text: 'Xabar tarixini ko‘rish', onPress: () => void showMessageHistory(message) });
    else options.push({ text: 'Yopish', style: 'cancel' });
    Alert.alert('Xabar amallari', 'Kerakli amalni tanlang.', options);
  };

  const uploadAndSendAttachment = async (uri: string, fileName: string, contentType: string, fileSize?: number, sourceFile?: Blob) => {
    const conversationId = active?.id;
    if (!conversationId || attachmentUploading || voiceUploading || recordingSession || mediaSendLockRef.current) return;
    const safeName = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 240) || 'attachment';
    mediaSendLockRef.current = true;
    setAttachmentUploading(true);
    try {
      const uploaded = await uploadCommunityMedia(uri, contentType, undefined, fileSize, sourceFile);
      if (active?.id !== conversationId) return;
      const message = await sendDirectAttachmentMessage(conversationId, safeName, {
        mediaKey: uploaded.mediaKey, mediaType: uploaded.mediaType, mediaSize: uploaded.size,
      }, newDirectMessageKey());
      if (active?.id === conversationId) {
        setMessages((rows) => rows.some((row) => row.id === message.id) ? rows : [...rows, message]);
        requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
        void loadConversations(true);
      }
    } catch (error) {
      if (active?.id === conversationId) showLocalizedAlert('Fayl yuborilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
    } finally { mediaSendLockRef.current = false; setAttachmentUploading(false); }
  };

  const chooseImage = async () => {
    if (!active || attachmentUploading || voiceUploading || recordingSession || mediaSendLockRef.current) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.88, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const fileExtension = asset.fileName?.split('.').pop()?.toLowerCase();
      const inferredType = fileExtension === 'png' ? 'image/png' : fileExtension === 'webp' ? 'image/webp' : ['jpg', 'jpeg'].includes(fileExtension || '') ? 'image/jpeg' : '';
      const contentType = imageTypes.includes(asset.mimeType || '') ? asset.mimeType! : inferredType;
      if (!contentType) { showLocalizedAlert('Rasm formati', 'JPG, PNG yoki WEBP rasm yuborish mumkin.'); return; }
      const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      await uploadAndSendAttachment(asset.uri, asset.fileName || `rasm.${extension}`, contentType, asset.fileSize, asset.file);
    } catch (error) { showLocalizedAlert('Rasm tanlanmadi', error instanceof Error ? error.message : 'Galereyani ochib bo‘lmadi'); }
  };

  const chooseDocument = async () => {
    if (!active || attachmentUploading || voiceUploading || recordingSession || mediaSendLockRef.current) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const lower = asset.name.toLowerCase();
      const allowedDocuments = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const inferredType = lower.endsWith('.pdf') ? 'application/pdf' : lower.endsWith('.doc') ? 'application/msword' : lower.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : '';
      const contentType = allowedDocuments.includes(asset.mimeType || '') ? asset.mimeType! : inferredType;
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(contentType)) {
        showLocalizedAlert('Hujjat formati', 'Faqat PDF, DOC va DOCX hujjatlar yuboriladi.'); return;
      }
      await uploadAndSendAttachment(asset.uri, asset.name, contentType, asset.size, asset.file);
    } catch (error) { showLocalizedAlert('Hujjat tanlanmadi', error instanceof Error ? error.message : 'Faylni tanlab bo‘lmadi'); }
  };

  const startVoiceRecording = async () => {
    if (!active || sending || voiceUploading || recordingSession || mediaSendLockRef.current) return;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { showLocalizedAlert('Mikrofon ruxsati', 'Ovozli xabar yozish uchun mikrofon ruxsatini bering.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      recordingConversationRef.current = active.id;
      audioRecorder.record({ forDuration: 120 });
      setRecordingSession(true);
    } catch (error) {
      showLocalizedAlert('Ovoz yozilmadi', error instanceof Error ? error.message : 'Mikrofonni ishga tushirib bo‘lmadi');
    }
  };

  const stopAndSendVoice = async () => {
    const conversationId = recordingConversationRef.current;
    if (!conversationId || active?.id !== conversationId || voiceUploading) {
      if (audioRecorder.isRecording) await audioRecorder.stop().catch(() => undefined);
      recordingConversationRef.current = null;
      setRecordingSession(false);
      return;
    }
    if (mediaSendLockRef.current) return;
    const durationSeconds = Math.min(120, Math.max(0, Math.round(audioRecorder.currentTime)));
    mediaSendLockRef.current = true;
    setVoiceUploading(true);
    try {
      if (audioRecorder.isRecording) await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri || durationSeconds < 1) throw new Error('Ovozli xabar juda qisqa yoki bo‘sh. Qayta yozib ko‘ring.');
      const contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      const webBlob = Platform.OS === 'web' ? await (await fetch(uri)).blob() : undefined;
      const uploaded = await uploadCommunityMedia(uri, contentType, undefined, undefined, webBlob);
      if (active?.id !== conversationId) return;
      const message = await sendDirectVoiceMessage(conversationId, {
        mediaKey: uploaded.mediaKey, mediaType: uploaded.mediaType, mediaSize: uploaded.size, durationSeconds,
      }, newDirectMessageKey());
      if (active?.id === conversationId) {
        setMessages((rows) => rows.some((row) => row.id === message.id) ? rows : [...rows, message]);
        requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
        void loadConversations(true);
      }
    } catch (error) {
      if (active?.id === conversationId) showLocalizedAlert('Ovozli xabar yuborilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring');
    } finally {
      recordingConversationRef.current = null;
      setRecordingSession(false);
      setVoiceUploading(false);
      mediaSendLockRef.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!recordingSession || !recordingConversationRef.current || active?.id === recordingConversationRef.current) return;
    if (audioRecorder.isRecording) void audioRecorder.stop().catch(() => undefined);
    recordingConversationRef.current = null;
    setRecordingSession(false);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  }, [active?.id, audioRecorder, recordingSession]);

  useEffect(() => () => {
    if (audioRecorder.isRecording) void audioRecorder.stop().catch(() => undefined);
    recordingConversationRef.current = null;
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  }, [audioRecorder]);

  const personAvatar = (person: DirectPerson, size = 48) => (
    <View style={[styles.avatarShell, { width: size, height: size, borderRadius: size / 2 }]}>
      {person.avatarUrl
        ? <Image source={{ uri: person.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><LocalizedText style={[styles.avatarInitial, { fontSize: Math.max(12, size * 0.28) }]}>{initials(person.displayName)}</LocalizedText></View>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
      <View style={styles.header}>
        <Pressable onPress={active ? () => setActive(null) : onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={active ? 'Suhbatlar ro‘yxatiga qaytish' : 'Orqaga'}>
          <Ionicons name={active ? 'chevron-back' : 'close'} size={22} color={c.text} />
        </Pressable>
        {active ? (
          <>
            {personAvatar(active.otherUser, 42)}
            <View style={styles.headerIdentity}>
              <LocalizedText style={styles.title} numberOfLines={1}>{active.otherUser.displayName}</LocalizedText>
              <LocalizedText style={styles.personHandle}>@{active.otherUser.username}</LocalizedText>
            </View>
            <View style={styles.headerChatMark}><Ionicons name="chatbubble-ellipses-outline" size={18} color={c.primary} /></View>
          </>
        ) : (
          <>
            <View style={styles.headerIdentity}>
              <LocalizedText style={styles.eyebrow}>ZELQEN CORE</LocalizedText>
              <LocalizedText style={styles.title}>Xabarlar</LocalizedText>
            </View>
            <View style={styles.headerChatMark}><Ionicons name="paper-plane" size={18} color={c.primary} /></View>
          </>
        )}
      </View>

      {active ? (
        <>
          <View style={styles.messagesArea}>
          <View pointerEvents="none" style={styles.wallpaper}>{[['happy-outline','4%','8%'],['game-controller-outline','28%','16%'],['planet-outline','72%','7%'],['heart-outline','88%','24%'],['musical-notes-outline','12%','39%'],['moon-outline','58%','34%'],['leaf-outline','82%','49%'],['star-outline','30%','57%'],['cafe-outline','7%','72%'],['paw-outline','68%','78%'],['gift-outline','91%','88%'],['sunny-outline','40%','91%']].map(([name,left,top],i)=><View key={i} style={[styles.wallpaperIcon,{left:left as `${number}%`,top:top as `${number}%` }]}><Ionicons name={name as any} size={24} color={isDark?'#8AA4B8':'#5B7D91'} /></View>)}</View>
          {chatLoading && messages.length === 0 ? <ActivityIndicator color={c.primary} style={{ flex: 1 }} /> : (
            <FlatList
              ref={messageListRef}
              style={styles.messageList}
              contentContainerStyle={[styles.messageContent, messages.length === 0 && { flexGrow: 1 }]}
              data={messages}
              keyExtractor={(message) => message.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              initialNumToRender={30}
              windowSize={9}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                stickToBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
              }}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                if (stickToBottomRef.current) messageListRef.current?.scrollToEnd({ animated: false });
              }}
              ListEmptyComponent={
                <View style={styles.firstMessage}>
                  <View style={styles.firstIcon}><Ionicons name="chatbubble-ellipses-outline" size={27} color={c.primary} /></View>
                  <LocalizedText style={styles.firstTitle}>Suhbatni boshlang</LocalizedText>
                  <LocalizedText style={styles.firstHint}>Salom deb yozing — muloqot shu yerdan boshlanadi.</LocalizedText>
                </View>
              }
              renderItem={({ item: message }) => (
                <View style={[styles.messageRow, message.isMine ? styles.myRow : styles.theirRow]}>
                  <Pressable onLongPress={() => showMessageActions(message)} delayLongPress={350} style={[styles.bubble, message.isMine ? styles.myBubble : styles.theirBubble]}>
                    {message.isDeleted
                      ? <LocalizedText style={[styles.messageText, styles.deletedMessageText, message.isMine && styles.myMessageTime]}>Bu xabar o‘chirildi</LocalizedText>
                      : message.mediaType?.startsWith('audio/')
                      ? <VoiceMessageBubble message={message} conversationId={active.id} isMine={message.isMine} colors={c} styles={styles} />
                      : message.mediaType
                        ? <AttachmentBubble message={message} conversationId={active.id} isMine={message.isMine} colors={c} styles={styles} />
                        : <LocalizedText style={[styles.messageText, message.isMine && styles.myMessageText]}>{message.content}</LocalizedText>}
                    <View style={styles.messageMeta}>
                      <LocalizedText style={[styles.messageTime, message.isMine && styles.myMessageTime]}>{timeLabel(message.createdAt)}</LocalizedText>
                      {message.isEdited && <LocalizedText style={[styles.messageTime, message.isMine && styles.myMessageTime]}>tahrirlangan</LocalizedText>}
                      {message.isMine && <Ionicons name={message.readAt ? 'checkmark-done' : 'checkmark'} size={14} color={message.readAt ? '#A7F3D0' : 'rgba(255,255,255,0.72)'} />}
                    </View>
                    </Pressable>
                </View>
              )}
            />
          )}
          </View>
          <View style={styles.composer}>
            {editingMessageId && <View style={styles.editingBanner}><LocalizedText style={styles.editingLabel}>Xabar tahrirlanmoqda</LocalizedText><Pressable onPress={() => { setEditingMessageId(null); setDraft(''); }} accessibilityRole="button" accessibilityLabel="Tahrirlashni bekor qilish"><Ionicons name="close-circle" size={19} color={c.primary} /></Pressable></View>}
            <View style={styles.inputShell}>
              <Pressable onPress={() => void chooseImage()} disabled={sending || voiceUploading || attachmentUploading || recordingSession} style={styles.innerAction} accessibilityRole="button" accessibilityLabel="Rasm yuborish"><Ionicons name="image-outline" size={22} color={c.primary} /></Pressable>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Xabar" placeholderTextColor={c.textMuted} style={styles.input} multiline maxLength={4000} accessibilityLabel="Xabar matni" />
              <Pressable onPress={() => void chooseDocument()} disabled={sending || voiceUploading || attachmentUploading || recordingSession} style={styles.innerAction} accessibilityRole="button" accessibilityLabel="Fayl biriktirish"><Ionicons name="attach" size={23} color={c.textMuted} /></Pressable>
            </View>
            {recordingSession && <LocalizedText style={styles.recordingTimer}>{Math.floor(recorderState.durationMillis / 60000)}:{String(Math.floor((recorderState.durationMillis % 60000) / 1000)).padStart(2, '0')}</LocalizedText>}
            {draft.trim() ? <Pressable onPress={() => void send()} disabled={sending} style={[styles.sendButton, sending && styles.sendDisabled]} accessibilityRole="button" accessibilityLabel="Xabarni yuborish">{sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name={editingMessageId ? 'checkmark' : 'send'} size={19} color="#FFFFFF" />}</Pressable> : <Pressable onPress={() => recordingSession ? void stopAndSendVoice() : void startVoiceRecording()} disabled={sending || voiceUploading || attachmentUploading} style={[styles.voiceRecordButton, recordingSession && styles.voiceRecordActive, (sending || voiceUploading || attachmentUploading) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={recordingSession ? 'Ovozli xabarni yuborish' : 'Ovozli xabar yozish'}>{voiceUploading || attachmentUploading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name={recordingSession ? (recorderState.isRecording ? 'stop' : 'send') : 'mic'} size={20} color="#FFFFFF" />}</Pressable>}
          </View>
        </>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          <View style={styles.listIntro}>
            <View style={styles.listIntroCopy}>
              <LocalizedText style={styles.listHeading}>Suhbatlaringiz</LocalizedText>
            </View>
            <View style={styles.totalPill}>
              <LocalizedText style={styles.totalNumber}>{conversations.length}</LocalizedText>
              <LocalizedText style={styles.totalLabel}>chat</LocalizedText>
            </View>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={c.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Ism yoki xabar bo‘yicha qidirish" placeholderTextColor={c.textMuted} style={styles.searchInput} returnKeyType="search" />
            {search.length > 0 && <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Qidiruvni tozalash"><Ionicons name="close-circle" size={18} color={c.textMuted} /></Pressable>}
          </View>
          <View style={styles.sectionHeader}>
            <LocalizedText style={styles.sectionTitle}>Oxirgi suhbatlar</LocalizedText>
            <LocalizedText style={styles.sectionHint}>SO‘NGGI</LocalizedText>
          </View>
          {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 35 }} /> : loadError ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={30} color={c.primary}/></View><LocalizedText style={styles.emptyTitle}>Xabarlar yuklanmadi</LocalizedText><LocalizedText style={styles.emptyText}>Internetni tekshirib, qayta urinib ko‘ring.</LocalizedText><Pressable onPress={()=>void loadConversations()} style={styles.clearSearch}><LocalizedText style={styles.clearSearchText}>Qayta urinish</LocalizedText></Pressable></View> : filteredConversations.map((conversation) => (
            <Pressable key={conversation.id} style={({ pressed }) => [styles.conversation, pressed && styles.conversationPressed]} onPress={() => openConversation(conversation)} accessibilityRole="button">
              <View style={styles.conversationAvatar}>
                {personAvatar(conversation.otherUser, 54)}
                {conversation.unreadCount > 0 && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.conversationBody}>
                <View style={styles.conversationTop}>
                  <LocalizedText style={styles.personName} numberOfLines={1}>{conversation.otherUser.displayName}</LocalizedText>
                  <LocalizedText style={[styles.time, conversation.unreadCount > 0 && styles.unreadTime]}>{conversation.lastMessage ? conversationTime(conversation.lastMessage.createdAt) : ''}</LocalizedText>
                </View>
                <View style={styles.conversationBottom}>
                  <LocalizedText style={[styles.preview, conversation.unreadCount > 0 && styles.unreadPreview]} numberOfLines={1}>
                    {conversation.lastMessage?.senderId ? (conversation.lastMessage.senderId === conversation.otherUser.id ? '' : 'Siz: ') : ''}{conversation.lastMessage?.content || 'Suhbatni boshlang'}
                  </LocalizedText>
                  {conversation.unreadCount > 0 && <View style={styles.unread}><LocalizedText style={styles.unreadText}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</LocalizedText></View>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </Pressable>
          ))}
          {!loading && !loadError && filteredConversations.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name={search ? 'search-outline' : 'paper-plane-outline'} size={30} color={c.primary} /></View>
              <LocalizedText style={styles.emptyTitle}>{search ? 'Hech narsa topilmadi' : 'Hali suhbatlar yo‘q'}</LocalizedText>
              <LocalizedText style={styles.emptyText}>{search ? 'Boshqa so‘z bilan qidiring.' : 'Profil orqali xabar yuboring.'}</LocalizedText>
              {search.length > 0 && <Pressable onPress={() => setSearch('')} style={styles.clearSearch}><LocalizedText style={styles.clearSearchText}>Qidiruvni tozalash</LocalizedText></Pressable>}
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: CommunityColors, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, minHeight: 0, backgroundColor: '#0E1621' },
    header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 3, paddingBottom: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#263544', backgroundColor: '#17212B' },
    back: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    headerIdentity: { flex: 1, minWidth: 0, gap: 2 },
    eyebrow: { color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
    title: { color: '#F5F7FA', fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
    headerChatMark: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    avatarShell: { overflow: 'hidden', backgroundColor: c.surfaceElevated },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1B3651' : '#E5F2FA' },
    avatarInitial: { color: c.primary, fontWeight: '900' },
    personHandle: { color: '#A5B4C0', fontSize: 12, marginTop: 1 },
    chatContext: { display: 'none' },
    contextIcon: { width: 23, height: 23, borderRadius: 8, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    contextText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    messagesArea: { flex: 1, minHeight: 0, position: 'relative' },
    messageList: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
    wallpaper: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
    wallpaperIcon: { position: 'absolute', opacity: 0.075 },
    messageContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
    messageRow: { width: '100%', flexDirection: 'row', marginBottom: 5 },
    myRow: { justifyContent: 'flex-end' },
    theirRow: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '86%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 18 },
    myBubble: { backgroundColor: '#6650B8', borderBottomRightRadius: 5 },
    theirBubble: { backgroundColor: '#202B36', borderWidth: 0, borderBottomLeftRadius: 5 },
    messageText: { color: '#F5F7FA', fontSize: 16, lineHeight: 22 },
    deletedMessageText: { fontStyle: 'italic', opacity: 0.8 },
    editingBanner: { position: 'absolute', bottom: '100%', left: 16, right: 16, minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.glassBorder },
    editingLabel: { color: c.primary, fontSize: 12, fontWeight: '800' },
    myMessageText: { color: '#FFFFFF' },
    messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
    messageTime: { color: '#B8C5D0', fontSize: 11 },
    myMessageTime: { color: isDark ? 'rgba(255,255,255,0.76)' : '#557181' },
    firstMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 45 },
    firstIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(154,216,255,0.14)' : 'rgba(52,126,169,0.09)' },
    firstTitle: { color: c.text, fontSize: 17, fontWeight: '900', marginTop: 15 },
    firstHint: { color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingHorizontal: 9, paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 9 : 7, borderTopWidth: 0, backgroundColor: '#17212B', flexShrink: 0 },
    inputShell: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 116, flexDirection: 'row', alignItems: 'center', borderRadius: 23, paddingHorizontal: 6, backgroundColor: '#202C38', borderWidth: 1, borderColor: '#344454' },
    innerAction: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, minWidth: 0, minHeight: 38, maxHeight: 104, paddingHorizontal: 5, paddingVertical: 8, color: '#F5F7FA', fontSize: 16, lineHeight: 21 },
    attachButton: { width: 36, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    imageAttachment: { width: 220, maxWidth: '100%', gap: 6 },
    attachmentImage: { width: 220, height: 170, borderRadius: 14, backgroundColor: c.surfaceElevated },
    attachmentLoading: { width: 220, height: 130, alignItems: 'center', justifyContent: 'center' },
    attachmentName: { color: c.text, fontSize: 12, fontWeight: '700' },
    documentAttachment: { minWidth: 205, maxWidth: 260, flexDirection: 'row', alignItems: 'center', gap: 10 },
    documentIcon: { width: 42, height: 46, borderRadius: 12, backgroundColor: isDark ? 'rgba(154,216,255,0.14)' : 'rgba(52,126,169,0.1)', alignItems: 'center', justifyContent: 'center' },
    documentIconMine: { backgroundColor: 'rgba(255,255,255,0.18)' },
    documentCopy: { flex: 1, minWidth: 0, gap: 4 },
    documentType: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
    voiceRecordButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3390EC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    voiceRecordActive: { backgroundColor: '#DC5656' },
    recordingTimer: { color: '#DC5656', fontSize: 12, fontWeight: '800', alignSelf: 'center' },
    voiceMessage: { minWidth: 190, flexDirection: 'row', alignItems: 'center', gap: 10 },
    voicePlay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(154,216,255,0.16)' : 'rgba(52,126,169,0.12)' },
    voicePlayMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
    voiceTrackWrap: { flex: 1, gap: 5 },
    voiceTrack: { height: 4, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(20,40,60,0.16)', overflow: 'hidden' },
    voiceProgress: { height: 4, borderRadius: 3, backgroundColor: '#3390EC' },
    voiceDuration: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3390EC', alignItems: 'center', justifyContent: 'center', shadowOpacity: 0, elevation: 0, flexShrink: 0 },
    sendDisabled: { opacity: 0.42, shadowOpacity: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 17, paddingTop: 21, paddingBottom: 130 },
    listIntro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    listIntroCopy: { flex: 1, gap: 4 },
    listHeading: { color: c.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
    listSubheading: { color: c.textMuted, fontSize: 14 },
    totalPill: { minWidth: 58, height: 38, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: isDark ? 'rgba(154,216,255,0.14)' : 'rgba(52,126,169,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    totalNumber: { color: c.primary, fontSize: 14, fontWeight: '900' },
    totalLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    searchBox: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    searchInput: { flex: 1, minWidth: 0, height: 47, color: c.text, fontSize: 14 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 },
    sectionTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    sectionHint: { color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    conversation: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 14, marginBottom: 10, borderRadius: 23, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    conversationPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
    conversationAvatar: { position: 'relative' },
    unreadDot: { position: 'absolute', right: 0, top: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#35C99A', borderWidth: 2, borderColor: c.surface },
    conversationBody: { flex: 1, minWidth: 0 },
    conversationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    conversationBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    personName: { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
    time: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    unreadTime: { color: c.primary, fontWeight: '800' },
    preview: { flex: 1, color: c.textMuted, fontSize: 13 },
    unreadPreview: { color: c.text, fontWeight: '700' },
    unread: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    unreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 54, paddingBottom: 36 },
    emptyIcon: { width: 72, height: 72, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(154,216,255,0.14)' : 'rgba(52,126,169,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    emptyTitle: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 16 },
    emptyText: { color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7 },
    clearSearch: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(139,92,246,0.17)' : 'rgba(139,92,246,0.09)' },
    clearSearchText: { color: c.primary, fontSize: 13, fontWeight: '700' },
  });
}
