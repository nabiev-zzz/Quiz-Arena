import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Socket } from 'socket.io-client';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import {
  createDirectSocket, getDirectConversations, getDirectMessages, markDirectRead,
  sendDirectMessage, startDirectConversation,
  type DirectConversation, type DirectMessage, type DirectPerson,
} from '../services/directMessagesService';

interface Props { onBack: () => void; initialUserId?: string | null; }
function initials(name: string) { return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'Z'; }
function timeLabel(value: string) { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

export default function DirectMessagesScreen({ onBack, initialUserId }: Props) {
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const styles = makeStyles(c, isDark);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [active, setActive] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const loadConversations = useCallback(async () => {
    try { setConversations(await getDirectConversations()); }
    catch (error) { showLocalizedAlert('Xabarlar', error instanceof Error ? error.message : 'Suhbatlar yuklanmadi'); }
    finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const rows = await getDirectMessages(conversationId);
      setMessages(rows);
      await markDirectRead(conversationId);
      setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
    } catch (error) { showLocalizedAlert('Chat', error instanceof Error ? error.message : 'Xabarlar yuklanmadi'); }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    let alive = true;
    createDirectSocket().then((client) => {
      if (!alive) { client.disconnect(); return; }
      socketRef.current = client;
      client.on('direct:message', (message: DirectMessage) => {
        void loadConversations();
        setActive((current) => {
          if (current?.id === message.conversationId) {
            setMessages((rows) => rows.some((row) => row.id === message.id) ? rows : [...rows, message]);
            if (!message.isMine) void markDirectRead(message.conversationId);
          }
          return current;
        });
      });
      client.on('direct:read', (event: { conversationId: string }) => {
        setMessages((rows) => rows.map((row) => row.conversationId === event.conversationId && row.isMine ? { ...row, readAt: new Date().toISOString() } : row));
      });
    }).catch(() => undefined);
    return () => { alive = false; socketRef.current?.disconnect(); socketRef.current = null; };
  // Socket is created once per screen mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadConversations();
      if (active) void loadMessages(active.id);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, loadConversations, loadMessages]);

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

  useEffect(() => { if (active) { setChatLoading(true); void loadMessages(active.id).finally(() => setChatLoading(false)); } else setMessages([]); }, [active?.id, loadMessages]);

  const openConversation = (conversation: DirectConversation) => setActive(conversation);
  const send = async () => {
    const text = draft.trim();
    if (!active || !text || sending) return;
    setSending(true);
    try {
      const message = await sendDirectMessage(active.id, text);
      setMessages((rows) => rows.some((row) => row.id === message.id) ? rows : [...rows, message]);
      setDraft('');
      void loadConversations();
    } catch (error) { showLocalizedAlert('Xabar yuborilmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring'); }
    finally { setSending(false); }
  };

  const personAvatar = (person: DirectPerson, size = 48) => person.avatarUrl
    ? <Image source={{ uri: person.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><LocalizedText style={styles.avatarInitial}>{initials(person.displayName)}</LocalizedText></View>;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
      <View style={styles.header}>
        <Pressable onPress={active ? () => setActive(null) : onBack} style={styles.back}><Ionicons name={active ? 'arrow-back' : 'close'} size={21} color={c.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <LocalizedText style={styles.eyebrow}>ZELQEN DIRECT</LocalizedText>
          <LocalizedText style={styles.title}>{active ? active.otherUser.displayName : 'Xabarlar'}</LocalizedText>
        </View>
        {active ? <View style={styles.onlineDot} /> : <Ionicons name="chatbubbles" size={23} color={c.primary} />}
      </View>

      {active ? (
        <>
          <View style={styles.chatSubhead}>
            {personAvatar(active.otherUser, 34)}
            <View style={{ flex: 1 }}>
              <LocalizedText style={styles.personName}>{active.otherUser.displayName}</LocalizedText>
              <LocalizedText style={styles.personHandle}>@{active.otherUser.username}</LocalizedText>
            </View>
          </View>
          {chatLoading && messages.length === 0 ? <ActivityIndicator color={c.primary} style={{ flex: 1 }} /> : (
            <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
              {messages.length === 0 && <View style={styles.firstMessage}><Ionicons name="hand-left-outline" size={30} color={c.primary} /><LocalizedText style={styles.firstTitle}>Suhbatni boshlang</LocalizedText><LocalizedText style={styles.firstHint}>Birinchi xabaringizni yuboring.</LocalizedText></View>}
              {messages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.isMine ? styles.myRow : styles.theirRow]}>
                  <View style={[styles.bubble, message.isMine ? styles.myBubble : styles.theirBubble]}>
                    <LocalizedText style={[styles.messageText, message.isMine && styles.myMessageText]}>{message.content}</LocalizedText>
                    <View style={styles.messageMeta}>
                      <LocalizedText style={[styles.messageTime, message.isMine && styles.myMessageTime]}>{timeLabel(message.createdAt)}</LocalizedText>
                      {message.isMine && <Ionicons name={message.readAt ? 'checkmark-done' : 'checkmark'} size={13} color={message.readAt ? '#8DE1D0' : 'rgba(255,255,255,0.65)'} />}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.composer}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Xabar yozing..." placeholderTextColor={c.textMuted} style={styles.input} multiline maxLength={4000} />
            <Pressable onPress={() => void send()} disabled={!draft.trim() || sending} style={[styles.sendButton, (!draft.trim() || sending) && { opacity: 0.5 }]}>
              {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="send" size={17} color="#FFFFFF" />}
            </Pressable>
          </View>
        </>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 35 }} /> : conversations.map((conversation) => (
            <Pressable key={conversation.id} style={styles.conversation} onPress={() => openConversation(conversation)}>
              {personAvatar(conversation.otherUser, 52)}
              <View style={styles.conversationBody}>
                <View style={styles.conversationTop}>
                  <LocalizedText style={styles.personName} numberOfLines={1}>{conversation.otherUser.displayName}</LocalizedText>
                  <LocalizedText style={styles.time}>{conversation.lastMessage ? timeLabel(conversation.lastMessage.createdAt) : ''}</LocalizedText>
                </View>
                <View style={styles.conversationBottom}>
                  <LocalizedText style={styles.preview} numberOfLines={1}>{conversation.lastMessage?.content || 'Suhbatni boshlang'}</LocalizedText>
                  {conversation.unreadCount > 0 && <View style={styles.unread}><LocalizedText style={styles.unreadText}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</LocalizedText></View>}
                </View>
              </View>
            </Pressable>
          ))}
          {!loading && conversations.length === 0 && <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={40} color={c.primary} /><LocalizedText style={styles.emptyTitle}>Hali suhbatlar yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>Hamjamiyatdan foydalanuvchi profilini ochib, Xabar yuborish tugmasini bosing.</LocalizedText></View>}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    back: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    eyebrow: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
    title: { color: c.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#39C99A' },
    chatSubhead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceElevated },
    avatarInitial: { color: c.text, fontSize: 13, fontWeight: '900' },
    personName: { color: c.text, fontSize: 13, fontWeight: '900' },
    personHandle: { color: c.textMuted, fontSize: 10, marginTop: 2 },
    messageList: { flex: 1 },
    messageContent: { padding: 16, paddingBottom: 22, flexGrow: 1, justifyContent: 'flex-end' },
    messageRow: { width: '100%', flexDirection: 'row', marginBottom: 9 },
    myRow: { justifyContent: 'flex-end' },
    theirRow: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7, borderRadius: 18 },
    myBubble: { backgroundColor: c.primary, borderBottomRightRadius: 5 },
    theirBubble: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, borderBottomLeftRadius: 5 },
    messageText: { color: c.text, fontSize: 13, lineHeight: 19 },
    myMessageText: { color: '#FFFFFF' },
    messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
    messageTime: { color: c.textMuted, fontSize: 9 },
    myMessageTime: { color: 'rgba(255,255,255,0.7)' },
    firstMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    firstTitle: { color: c.text, fontSize: 15, fontWeight: '900', marginTop: 10 },
    firstHint: { color: c.textMuted, fontSize: 11, marginTop: 4 },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 12, borderTopWidth: 1, borderTopColor: c.glassBorder, backgroundColor: c.surface },
    input: { flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 13, backgroundColor: c.background },
    sendButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 130 },
    conversation: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    conversationBody: { flex: 1 },
    conversationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    conversationBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
    time: { color: c.textMuted, fontSize: 9 },
    preview: { flex: 1, color: c.textMuted, fontSize: 11 },
    unread: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    unreadText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
    empty: { alignItems: 'center', padding: 32, marginTop: 40 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '900', marginTop: 12 },
    emptyText: { color: c.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  });
}
