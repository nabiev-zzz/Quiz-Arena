import { LocalizedText, LocalizedTextInput } from '../i18n/LocalizedText';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
} from 'react-native';

import {
  AiTutorMessage,
  getTutorHistory,
  sendTutorMessage,
} from '../services/aiTutorService';
import { useTheme } from '../theme/ThemeContext';

interface AiTutorScreenProps {
  onBack: () => void;
  bottomDockSpace?: number;
  dockStretch?: SharedValue<number>;
}

const CONNECTION_ERROR =
  'Serverga ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';

export default function AiTutorScreen({
  onBack,
  bottomDockSpace = 0,
  dockStretch,
}: AiTutorScreenProps) {
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
      dockStretch.value = withSpring(
        Math.max(-1, Math.min(1, delta / 30)),
        { damping: 11, stiffness: 160, mass: 0.7 },
      );
    },
    onEndDrag: () => {
      if (dockStretch) {
        dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 });
      }
    },
    onMomentumEnd: () => {
      if (dockStretch) {
        dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 });
      }
    },
  });

  const [messages, setMessages] = useState<AiTutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyFailed, setHistoryFailed] = useState(false);
  const [failedMessageIds, setFailedMessageIds] = useState<string[]>([]);
  const [quotaInfo, setQuotaInfo] = useState<{ limit: number | null; remaining: number | null; used: number | null } | null>(null);

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
    const timeout = setTimeout(() => controller.abort(), 45000);

    setSending(true);
    setError('');

    try {
      const result = await sendTutorMessage(message, controller.signal);

      setMessages((previous) => [
        ...previous.filter((item) => item.id !== temporaryId),
        result.userMessage,
        result.assistantMessage,
      ]);
      setQuotaInfo(result.usage ?? null);

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

      setError(err instanceof Error && err.message ? err.message : CONNECTION_ERROR);
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
            <LocalizedText style={styles.avatarText}>AI</LocalizedText>
          </View>
        )}

        <View style={styles.messageContent}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
{isUser ? (
              <LocalizedText style={[styles.messageText, styles.userMessageText]}>
                {item.content}
              </LocalizedText>
            ) : (
              <TutorFormattedMessage content={item.content} colors={colors} />
            )}
          </View>

          {canRetry && (
            <Pressable
              onPress={() => void retryMessage(item)}
              disabled={sending}
              style={styles.messageRetryButton}
            >
              <LocalizedText style={styles.messageRetryText}>
                {sending ? 'Yuborilmoqda...' : '↻ Qayta yuborish'}
              </LocalizedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        bottomDockSpace > 0 && { paddingBottom: bottomDockSpace },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <LocalizedText style={styles.backText}>‹</LocalizedText>
          </Pressable>

          <View style={styles.headerInfo}>
            <LocalizedText style={styles.headerTitle}>Shaxsiy AI Ustoz</LocalizedText>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <LocalizedText style={styles.onlineText}>O‘qishga tayyor</LocalizedText>
            </View>
            {quotaInfo ? (
              <LocalizedText style={styles.quotaText}>
                {quotaInfo.limit === null ? 'AI Ustoz: cheksiz' : `Bugun ${quotaInfo.remaining ?? 0}/${quotaInfo.limit} ta xabar qoldi`}
              </LocalizedText>
            ) : null}
          </View>

          <View style={styles.headerAvatar}>
            <LocalizedText style={styles.headerAvatarText}>AI</LocalizedText>
          </View>
        </View>

        {loadingHistory ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <LocalizedText style={styles.loadingText}>
              Suhbat tarixi yuklanmoqda...
            </LocalizedText>
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            style={styles.messageScroll}
            onScroll={dockScrollHandler}
            scrollEventThrottle={16}
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
                  <LocalizedText style={styles.welcomeIconText}>✦</LocalizedText>
                </View>

                <LocalizedText style={styles.welcomeTitle}>
                  Salom! Men sizning AI Ustozingizman.
                </LocalizedText>

                <LocalizedText style={styles.welcomeDescription}>
                  Istalgan fan yoki mavzu bo‘yicha savol bering.
                  Men tushuntiraman, misollar keltiraman va
                  bilimlaringizni mustahkamlashga yordam beraman.
                </LocalizedText>

                <View style={styles.suggestion}>
                  <LocalizedText style={styles.suggestionText}>
                    Matematikada kasrlarni tushuntirib ber
                  </LocalizedText>
                </View>

                <View style={styles.suggestion}>
                  <LocalizedText style={styles.suggestionText}>
                    Ingliz tilini qanday o‘rgansam bo‘ladi?
                  </LocalizedText>
                </View>
              </View>
            }
            ListFooterComponent={
              sending ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <LocalizedText style={styles.typingText}>
                    AI Ustoz javob tayyorlamoqda...
                  </LocalizedText>
                </View>
              ) : undefined
            }
          />
        )}

        {!!error && (
          <View style={styles.errorContainer}>
            <LocalizedText style={styles.errorText}>{error}</LocalizedText>
            {historyFailed && (
              <Pressable onPress={() => void loadHistory()}>
                <LocalizedText style={styles.retryText}>Qayta urinish</LocalizedText>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.inputContainer}>
          <LocalizedTextInput
            style={styles.input}
            placeholder="Savolingizni yozing..."
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
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
              <LocalizedText style={styles.sendButtonText}>↑</LocalizedText>
            )}
          </Pressable>
        </View>

        <LocalizedText style={styles.footerText}>
          AI javoblarini muhim ma’lumotlar bilan solishtirib tekshiring.
        </LocalizedText>
      </KeyboardAvoidingView>
    </View>
  );
}


type TutorColors = ReturnType<typeof useTheme>['tokens']['colors'];

function TutorFormattedMessage({
  content,
  colors,
}: {
  content: string;
  colors: TutorColors;
}) {
  const lines = content.replace(/\r/g, '').split('\n');
  const inline = (value: string, keyPrefix: string) => {
    const pieces = value.split(/(\*\*[^*]+\*\*)/g);
    return pieces.map((piece, index) =>
      piece.startsWith('**') && piece.endsWith('**') ? (
        <NativeText key={keyPrefix + index} style={{ fontWeight: '800', color: colors.text }}>
          {piece.slice(2, -2)}
        </NativeText>
      ) : (
        <NativeText key={keyPrefix + index}>{piece}</NativeText>
      ),
    );
  };

  return (
    <View style={{ gap: 7 }}>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <View key={index} style={{ height: 2 }} />;
        if (/^[-*_]{3,}$/.test(line)) {
          return <View key={index} style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />;
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          return (
            <NativeText
              key={index}
              style={{
                color: colors.text,
                fontSize: heading[1].length === 1 ? 17 : 15,
                lineHeight: 22,
                fontWeight: '900',
                marginTop: index === 0 ? 0 : 5,
              }}
            >
              {inline(heading[2], 'h' + index)}
            </NativeText>
          );
        }
        const metric = line.match(/^(?:[-•]\s*)?\*\*(.+?)\*\*\s*:\s*(.+)$/);
        if (metric) {
          return (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <NativeText style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
                {metric[1]}
              </NativeText>
              <NativeText style={{ color: colors.primary, fontSize: 14, fontWeight: '900', textAlign: 'right' }}>
                {inline(metric[2], 'v' + index)}
              </NativeText>
            </View>
          );
        }
        const bullet = line.match(/^[-•]\s+(.+)$/);
        if (bullet) {
          return (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <NativeText style={{ color: colors.primary, fontSize: 16, lineHeight: 22 }}>•</NativeText>
              <NativeText style={{ color: colors.text, fontSize: 14, lineHeight: 21, flex: 1 }}>
                {inline(bullet[1], 'b' + index)}
              </NativeText>
            </View>
          );
        }
        const numbered = line.match(/^\d+[.)]\s+(.+)$/);
        if (numbered) {
          return (
            <NativeText key={index} style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>
              {inline(line, 'n' + index)}
            </NativeText>
          );
        }
        return (
          <NativeText key={index} style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>
            {inline(line, 'p' + index)}
          </NativeText>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: { flex: 1 },
  header: {
    minHeight: 74,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 34,
    lineHeight: 38,
    color: colors.primary,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#25B879',
    marginRight: 6,
  },
  quotaText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  onlineText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#6759E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
  },
  messageScroll: { flex: 1 },
  messageList: {
    padding: 16,
    paddingBottom: 22,
    flexGrow: 1,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 10,
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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  messageContent: {
    maxWidth: '84%',
    minWidth: 0,
    flexShrink: 1,
  },
  messageBubble: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 17,
  },
  userBubble: {
    backgroundColor: '#6759E8',
    borderBottomRightRadius: 5,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  userMessageText: { color: '#FFFFFF' },
  assistantMessageText: { color: colors.text },
  messageRetryButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  messageRetryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 35,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  welcomeIconText: {
    fontSize: 34,
    color: colors.primary,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  suggestion: {
    width: '100%',
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 9,
  },
  suggestionText: {
    color: colors.primary,
    fontSize: 13,
    textAlign: 'center',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 9,
  },
  typingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerSurface,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  retryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  inputContainer: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 12,
    marginTop: 8,
    padding: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    paddingHorizontal: 11,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    backgroundColor: 'transparent',
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#7657E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  });
}
