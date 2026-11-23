
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  AiTutorMessage,
  getTutorHistory,
  sendTutorMessage,
} from '../services/aiTutorService';

interface AiTutorScreenProps {
  onBack: () => void;
}

const CONNECTION_ERROR =
  'Serverga ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';

export default function AiTutorScreen({ onBack }: AiTutorScreenProps) {
  const [messages, setMessages] = useState<AiTutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyFailed, setHistoryFailed] = useState(false);
  const [failedMessageIds, setFailedMessageIds] = useState<string[]>([]);

  const listRef = useRef<FlatList<AiTutorMessage>>(null);

  const loadHistory = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    setLoadingHistory(true);
    setHistoryFailed(false);
    setError('');

    try {
      const history = await getTutorHistory(controller.signal);
      setMessages(history);
    } catch (err) {
      console.log('AI Tutor history error:', err);
      setHistoryFailed(true);
      setError(CONNECTION_ERROR);
    } finally {
      clearTimeout(timeout);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submitMessage = async (message: string, temporaryId: string) => {
    if (sending) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    setSending(true);
    setError('');

    try {
      const result = await sendTutorMessage(message, controller.signal);

      setMessages((previous) => [
        ...previous.filter((item) => item.id !== temporaryId),
        result.userMessage,
        result.assistantMessage,
      ]);

      setFailedMessageIds((previous) =>
        previous.filter((id) => id !== temporaryId),
      );
    } catch (err) {
      console.log('AI Tutor send error:', err);

      setFailedMessageIds((previous) =>
        previous.includes(temporaryId)
          ? previous
          : [...previous, temporaryId],
      );

      setError(CONNECTION_ERROR);
    } finally {
      clearTimeout(timeout);
      setSending(false);
    }
  };

  const handleSend = async () => {
    const message = input.trim();

    if (!message || sending) return;

    const temporaryId = `temp-${Date.now()}`;

    const temporaryMessage: AiTutorMessage = {
      id: temporaryId,
      userId: '',
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, temporaryMessage]);
    setInput('');

    await submitMessage(message, temporaryId);
  };

  const retryMessage = async (item: AiTutorMessage) => {
    if (sending) return;
    await submitMessage(item.content, item.id);
  };

  const renderMessage = ({ item }: { item: AiTutorMessage }) => {
    const isUser = item.role === 'user';
    const canRetry = isUser && failedMessageIds.includes(item.id);

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.assistantRow,
        ]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
        )}

        <View>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isUser
                  ? styles.userMessageText
                  : styles.assistantMessageText,
              ]}
            >
              {item.content}
            </Text>
          </View>

          {canRetry && (
            <Pressable
              onPress={() => void retryMessage(item)}
              disabled={sending}
              style={styles.messageRetryButton}
            >
              <Text style={styles.messageRetryText}>
                {sending ? 'Yuborilmoqda...' : '↻ Qayta yuborish'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Shaxsiy AI Ustoz</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>O‘qishga tayyor</Text>
            </View>
          </View>

          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>AI</Text>
          </View>
        </View>

        {loadingHistory ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#A88FFF" />
            <Text style={styles.loadingText}>
              Suhbat tarixi yuklanmoqda...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.messageScroll}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIcon}>
                  <Text style={styles.welcomeIconText}>✦</Text>
                </View>

                <Text style={styles.welcomeTitle}>
                  Salom! Men sizning AI Ustozingizman.
                </Text>

                <Text style={styles.welcomeDescription}>
                  Istalgan fan yoki mavzu bo‘yicha savol bering.
                  Men tushuntiraman, misollar keltiraman va
                  bilimlaringizni mustahkamlashga yordam beraman.
                </Text>

                <View style={styles.suggestion}>
                  <Text style={styles.suggestionText}>
                    Matematikada kasrlarni tushuntirib ber
                  </Text>
                </View>

                <View style={styles.suggestion}>
                  <Text style={styles.suggestionText}>
                    Ingliz tilini qanday o‘rgansam bo‘ladi?
                  </Text>
                </View>
              </View>
            }
            ListFooterComponent={
              sending ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color="#A88FFF" />
                  <Text style={styles.typingText}>
                    AI Ustoz javob tayyorlamoqda...
                  </Text>
                </View>
              ) : undefined
            }
          />
        )}

        {!!error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {historyFailed && (
              <Pressable onPress={() => void loadHistory()}>
                <Text style={styles.retryText}>Qayta urinish</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Savolingizni yozing..."
            placeholderTextColor="#8B90A7"
            selectionColor="#A88FFF"
            cursorColor="#A88FFF"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
            editable={!sending}
            blurOnSubmit={false}
            returnKeyType="default"
          />

          <Pressable
            onPress={() => void handleSend()}
            disabled={!input.trim() || sending}
            style={[
              styles.sendButton,
              (!input.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>↑</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          AI javoblarini muhim ma’lumotlar bilan solishtirib tekshiring.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1020' },
  keyboardContainer: { flex: 1 },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11182A',
    borderBottomWidth: 1,
    borderBottomColor: '#252D41',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#252044',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 34, lineHeight: 38, color: '#A88FFF' },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#25B879',
    marginRight: 6,
  },
  onlineText: { fontSize: 12, color: '#8993AA' },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#6759E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#8993AA', fontSize: 13 },
  messageScroll: { flex: 1 },
  messageList: { padding: 18, paddingBottom: 24, flexGrow: 1 },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: '#6759E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: { backgroundColor: '#6759E8', borderBottomRightRadius: 5 },
  assistantBubble: {
    backgroundColor: '#171F34',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#29334B',
  },
  messageText: { fontSize: 14, lineHeight: 22 },
  userMessageText: { color: '#FFFFFF' },
  assistantMessageText: { color: '#E5E7F0' },
  messageRetryButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  messageRetryText: { color: '#C3B5FF', fontSize: 12, fontWeight: '700' },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 35,
  },
  welcomeIcon: {
    width: 66,
    height: 66,
    borderRadius: 23,
    backgroundColor: '#252044',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  welcomeIconText: { fontSize: 34, color: '#A88FFF' },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#A5AEC2',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  suggestion: {
    width: '100%',
    padding: 13,
    borderRadius: 13,
    backgroundColor: '#171F34',
    borderWidth: 1,
    borderColor: '#29334B',
    marginTop: 9,
  },
  suggestionText: { color: '#C3B5FF', fontSize: 13, textAlign: 'center' },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 9 },
  typingText: { color: '#8993AA', fontSize: 12 },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#351F32',
  },
  errorText: { color: '#FF9DAA', fontSize: 12 },
  retryText: { color: '#C3B5FF', fontSize: 12, fontWeight: '700', marginTop: 5 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 14,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#171F34',
    borderWidth: 1,
    borderColor: '#29334B',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: 'transparent',
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#7657E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  footerText: {
    fontSize: 10,
    color: '#8993AA',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});
