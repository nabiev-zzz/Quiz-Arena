import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Socket } from 'socket.io-client';
import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import { communityTokens, type CommunityColors } from '../theme/communityTokens';
import {
  createDirectSocket, getDirectConversations, getDirectMessages, markDirectRead,
  sendDirectMessage, startDirectConversation,
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

export default function DirectMessagesScreen({ onBack, initialUserId }: Props) {
  const { mode, isDark } = useTheme();
  const c = communityTokens[mode].colors;
  const styles = makeStyles(c, isDark);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [active, setActive] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
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
          <View style={styles.chatContext}>
            <View style={styles.contextIcon}><Ionicons name="lock-closed-outline" size={14} color={c.textMuted} /></View>
            <LocalizedText style={styles.contextText}>Shaxsiy suhbat</LocalizedText>
          </View>
          {chatLoading && messages.length === 0 ? <ActivityIndicator color={c.primary} style={{ flex: 1 }} /> : (
            <ScrollView
              style={styles.messageList}
              contentContainerStyle={styles.messageContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && (
                <View style={styles.firstMessage}>
                  <View style={styles.firstIcon}><Ionicons name="chatbubble-ellipses-outline" size={27} color={c.primary} /></View>
                  <LocalizedText style={styles.firstTitle}>Suhbatni boshlang</LocalizedText>
                  <LocalizedText style={styles.firstHint}>Salom deb yozing — muloqot shu yerdan boshlanadi.</LocalizedText>
                </View>
              )}
              {messages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.isMine ? styles.myRow : styles.theirRow]}>
                  <View style={[styles.bubble, message.isMine ? styles.myBubble : styles.theirBubble]}>
                    <LocalizedText style={[styles.messageText, message.isMine && styles.myMessageText]}>{message.content}</LocalizedText>
                    <View style={styles.messageMeta}>
                      <LocalizedText style={[styles.messageTime, message.isMine && styles.myMessageTime]}>{timeLabel(message.createdAt)}</LocalizedText>
                      {message.isMine && <Ionicons name={message.readAt ? 'checkmark-done' : 'checkmark'} size={14} color={message.readAt ? '#A7F3D0' : 'rgba(255,255,255,0.72)'} />}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.composer}>
            <View style={styles.inputShell}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Xabar yozing..."
                placeholderTextColor={c.textMuted}
                style={styles.input}
                multiline
                maxLength={4000}
                accessibilityLabel="Xabar matni"
              />
            </View>
            <Pressable onPress={() => void send()} disabled={!draft.trim() || sending} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]} accessibilityRole="button" accessibilityLabel="Xabarni yuborish">
              {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />}
            </Pressable>
          </View>
        </>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          <View style={styles.listIntro}>
            <View style={styles.listIntroCopy}>
              <LocalizedText style={styles.listHeading}>Suhbatlaringiz</LocalizedText>
              <LocalizedText style={styles.listSubheading}>Barcha shaxsiy xabarlar bir joyda.</LocalizedText>
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
            <LocalizedText style={styles.sectionHint}>YANGILANIB TURADI</LocalizedText>
          </View>
          {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 35 }} /> : filteredConversations.map((conversation) => (
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
          {!loading && filteredConversations.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name={search ? 'search-outline' : 'paper-plane-outline'} size={30} color={c.primary} /></View>
              <LocalizedText style={styles.emptyTitle}>{search ? 'Hech narsa topilmadi' : 'Hali suhbatlar yo‘q'}</LocalizedText>
              <LocalizedText style={styles.emptyText}>{search ? 'Boshqa ism yoki kalit so‘z bilan qidirib ko‘ring.' : 'Hamjamiyatdagi foydalanuvchi profilini oching va “Xabar yuborish” tugmasini bosing.'}</LocalizedText>
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
    screen: { flex: 1, backgroundColor: c.background },
    header: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: c.glassBorder, backgroundColor: c.background },
    back: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    headerIdentity: { flex: 1, minWidth: 0, gap: 2 },
    eyebrow: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
    title: { color: c.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.55 },
    headerChatMark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.09)' },
    avatarShell: { overflow: 'hidden', backgroundColor: c.surfaceElevated },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#30284B' : '#EEE9FF' },
    avatarInitial: { color: c.primary, fontWeight: '900' },
    personHandle: { color: c.textMuted, fontSize: 11, marginTop: 1 },
    chatContext: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 9 },
    contextIcon: { width: 23, height: 23, borderRadius: 8, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    contextText: { color: c.textMuted, fontSize: 10, fontWeight: '600' },
    messageList: { flex: 1 },
    messageContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22, flexGrow: 1, justifyContent: 'flex-end' },
    messageRow: { width: '100%', flexDirection: 'row', marginBottom: 10 },
    myRow: { justifyContent: 'flex-end' },
    theirRow: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '84%', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 9, borderRadius: 23 },
    myBubble: { backgroundColor: c.primary, borderBottomRightRadius: 6 },
    theirBubble: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, borderBottomLeftRadius: 6 },
    messageText: { color: c.text, fontSize: 14, lineHeight: 21 },
    myMessageText: { color: '#FFFFFF' },
    messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
    messageTime: { color: c.textMuted, fontSize: 10 },
    myMessageTime: { color: 'rgba(255,255,255,0.76)' },
    firstMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 45 },
    firstIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(139,92,246,0.16)' : 'rgba(139,92,246,0.09)' },
    firstTitle: { color: c.text, fontSize: 17, fontWeight: '900', marginTop: 15 },
    firstHint: { color: c.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 15, paddingTop: 13, paddingBottom: Platform.OS === 'ios' ? 14 : 12, borderTopWidth: 1, borderTopColor: c.glassBorder, backgroundColor: c.surface },
    inputShell: { flex: 1, minHeight: 48, maxHeight: 125, justifyContent: 'center', borderRadius: 20, paddingHorizontal: 14, backgroundColor: c.background, borderWidth: 1, borderColor: c.glassBorder },
    input: { minHeight: 42, maxHeight: 108, paddingVertical: 10, color: c.text, fontSize: 14, lineHeight: 19 },
    sendButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOpacity: 0.25, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    sendDisabled: { opacity: 0.42, shadowOpacity: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 17, paddingTop: 21, paddingBottom: 130 },
    listIntro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    listIntroCopy: { flex: 1, gap: 4 },
    listHeading: { color: c.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
    listSubheading: { color: c.textMuted, fontSize: 12 },
    totalPill: { minWidth: 58, height: 38, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: isDark ? 'rgba(139,92,246,0.16)' : 'rgba(139,92,246,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    totalNumber: { color: c.primary, fontSize: 14, fontWeight: '900' },
    totalLabel: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
    searchBox: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    searchInput: { flex: 1, minWidth: 0, height: 47, color: c.text, fontSize: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
    sectionHint: { color: c.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
    conversation: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 14, marginBottom: 10, borderRadius: 23, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    conversationPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
    conversationAvatar: { position: 'relative' },
    unreadDot: { position: 'absolute', right: 0, top: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#35C99A', borderWidth: 2, borderColor: c.surface },
    conversationBody: { flex: 1, minWidth: 0 },
    conversationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    conversationBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    personName: { color: c.text, fontSize: 13, fontWeight: '800', flex: 1 },
    time: { color: c.textMuted, fontSize: 10, fontWeight: '600' },
    unreadTime: { color: c.primary, fontWeight: '800' },
    preview: { flex: 1, color: c.textMuted, fontSize: 11 },
    unreadPreview: { color: c.text, fontWeight: '700' },
    unread: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    unreadText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
    empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 54, paddingBottom: 36 },
    emptyIcon: { width: 72, height: 72, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(139,92,246,0.16)' : 'rgba(139,92,246,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '900', marginTop: 16 },
    emptyText: { color: c.textMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
    clearSearch: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(139,92,246,0.17)' : 'rgba(139,92,246,0.09)' },
    clearSearchText: { color: c.primary, fontSize: 12, fontWeight: '800' },
  });
}
