publishClip()} disabled={clipBusy || !selectedClip} style={[styles.publishClipButton, (clipBusy || !selectedClip) && { opacity: 0.48 }]}>
              {clipBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
              <LocalizedText style={styles.publishClipButtonText}>{clipBusy ? 'Yuklanmoqda...' : 'Yuklash va joylash'}</LocalizedText>
            </Pressable>
            {loading ? <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 30 }} /> : clips.length === 0 ? (
              <View style={styles.clipsEmpty}>
                <Ionicons name="videocam-outline" size={38} color={c.primary} />
                <LocalizedText style={styles.clipsEmptyTitle}>Hali videolar yo‘q</LocalizedText>
                <LocalizedText style={styles.clipsEmptyText}>Birinchi videoni siz joylang.</LocalizedText>
              </View>
            ) : clips.map((clip) => (
              <View key={clip.id} style={styles.clipCard}>
                <View style={styles.clipAuthor}>{renderPerson(clip.author)}<LocalizedText style={styles.time}>{timeAgo(clip.createdAt)}</LocalizedText></View>
                {clip.mediaUrl ? <CommunityClipVideo uri={clip.mediaUrl} /> : null}
                {clip.content ? <LocalizedText style={styles.clipCaption}>{clip.content}</LocalizedText> : null}
                <View style={styles.clipActions}>
                  <Pressable style={styles.action} onPress={() => void toggleLike(clip)} disabled={busyPost === clip.id}>
                    <Ionicons name={clip.isLiked ? 'heart' : 'heart-outline'} size={20} color={clip.isLiked ? '#F05B82' : c.textMuted} />
                    <LocalizedText style={styles.actionText}>{clip.likesCount}</LocalizedText>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => void openComments(clip.id)}>
                    <Ionicons name="chatbubble-outline" size={18} color={c.textMuted} />
                    <LocalizedText style={styles.actionText}>{clip.commentsCount} izoh</LocalizedText>
                  </Pressable>
                </View>
                {expandedPost === clip.id && (
                  <View style={styles.comments}>
                    {(comments[clip.id] || []).map((comment) => <View key={comment.id} style={styles.comment}><LocalizedText style={styles.commentAuthor}>@{comment.author.username}</LocalizedText><LocalizedText style={styles.commentText}>{comment.content}</LocalizedText></View>)}
                    <View style={styles.commentComposer}>
                      <TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder="Izoh yozing..." placeholderTextColor={c.textMuted} style={styles.commentInput} maxLength={1000} />
                      <Pressable onPress={() => void sendComment(clip.id)} disabled={!commentDraft.trim() || sendingComment} style={styles.commentSend}><Ionicons name="send" size={16} color="#FFFFFF" /></Pressable>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(selectedStory)} transparent animationType="fade" onRequestClose={() => setSelectedStory(null)}>
        {selectedStory && (
          <View style={styles.storyViewer}>
            <Image source={{ uri: selectedStory.mediaUrl }} style={styles.storyViewerImage} resizeMode="contain" />
            <View style={styles.storyViewerTop}>
              <View style={styles.storyViewerPerson}>
                {selectedStory.author.avatarUrl
                  ? <Image source={{ uri: selectedStory.author.avatarUrl }} style={styles.storyViewerAvatar} />
                  : <View style={styles.storyViewerAvatarFallback}><LocalizedText style={styles.storyViewerInitial}>{initials(selectedStory.author.displayName)}</LocalizedText></View>}
                <View>
                  <LocalizedText style={styles.storyViewerName}>{selectedStory.isOwn ? 'Siz' : selectedStory.author.displayName}</LocalizedText>
                  <LocalizedText style={styles.storyViewerTime}>{timeAgo(selectedStory.createdAt)}</LocalizedText>
                </View>
              </View>
              <Pressable onPress={() => setSelectedStory(null)} style={styles.storyClose}><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>
            </View>
            {selectedStory.caption ? <LocalizedText style={styles.storyCaption}>{selectedStory.caption}</LocalizedText> : null}
            {selectedStory.isOwn ? <LocalizedText style={styles.storyViews}><Ionicons name="eye-outline" size={14} color="#FFFFFF" />  {selectedStory.viewsCount} ko‘rish</LocalizedText> : null}
          </View>
        )}
      </Modal>
    </>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    sectionTabs: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 16, padding: 4, marginBottom: 18, gap: 5 },
    sectionTab: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
    sectionTabActive: { backgroundColor: c.primary },
    sectionTabText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    sectionTabTextActive: { color: '#FFFFFF' },
    clipsSection: { gap: 16, paddingBottom: 28 },
    clipGuidance: { color: c.textMuted, fontSize: 11, lineHeight: 17, marginTop: -8 },
    selectedClipCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    selectedClipIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.16)' : 'rgba(137,111,255,0.1)' },
    selectedClipName: { color: c.text, fontSize: 12, fontWeight: '800' },
    selectedClipMeta: { color: c.textMuted, fontSize: 10, marginTop: 4 },
    removeClipButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    uploadProgressCard: { borderRadius: 15, padding: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, gap: 9 },
    uploadProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    uploadProgressTitle: { color: c.text, fontSize: 12, fontWeight: '800' },
    uploadProgressPercent: { color: c.primary, fontSize: 12, fontWeight: '900' },
    uploadProgressTrack: { height: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: c.background },
    uploadProgressFill: { height: '100%', borderRadius: 8, backgroundColor: c.primary },
    uploadProgressHint: { color: c.textMuted, fontSize: 10, lineHeight: 15 },
    publishClipButton: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: c.primary },
    publishClipButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

    clipCaptionInput: { minHeight: 44, borderRadius: 12, paddingHorizontal: 13, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, fontSize: 13 },
    clipsIntro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    clipsTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
    clipsSubtitle: { color: c.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
    createClipButton: { backgroundColor: c.primary, borderRadius: 13, minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
    createClipText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
    clipsEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 9, backgroundColor: c.surface, borderRadius: 20 },
    clipsEmptyTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    clipsEmptyText: { color: c.textMuted, fontSize: 13 },
    clipCard: { backgroundColor: c.surface, borderRadius: 22, padding: 12, gap: 10, borderWidth: 1, borderColor: c.border },
    clipAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clipCaption: { color: c.text, fontSize: 14, lineHeight: 20 },
    clipActions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 4 },
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 150 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    eyebrow: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
    title: { color: c.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
    messagesButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    discoverText: { color: c.primary, fontSize: 11, fontWeight: '800' },
    intro: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, marginBottom: 14, backgroundColor: isDark ? 'rgba(116,91,220,0.16)' : 'rgba(116,91,220,0.09)', borderWidth: 1, borderColor: c.glassBorder },
    introIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    introTitle: { color: c.text, fontSize: 14, fontWeight: '900' },
    introSubtitle: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
    storySection: { marginBottom: 16 },
    storyHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
    storyList: { gap: 13, paddingVertical: 2, paddingRight: 10 },
    storyItem: { width: 66, alignItems: 'center', gap: 5 },
    storyRing: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', padding: 3 },
    addStoryRing: { borderWidth: 1.5, borderColor: c.glassBorder, backgroundColor: c.surface },
    storyUnseen: { borderWidth: 2.5, borderColor: '#8B5CF6' },
    storySeen: { borderWidth: 1.5, borderColor: c.textMuted },
    storyAvatar: { width: 50, height: 50, borderRadius: 25 },
    storyFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    storyName: { color: c.textMuted, fontSize: 9, maxWidth: 66 },
    composer: { padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 22 },
    composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    composerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(137,111,255,0.18)' : 'rgba(137,111,255,0.12)' },
    input: { flex: 1, minHeight: 62, maxHeight: 150, color: c.text, fontSize: 13, lineHeight: 19, paddingTop: 8 },
    imagePreviewWrap: { marginTop: 10, borderRadius: 15, overflow: 'hidden', alignSelf: 'flex-start', width: '100%', maxHeight: 220 },
    imagePreview: { width: '100%', height: 200, borderRadius: 15 },
    removeImage: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
    composerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11, marginTop: 8 },
    composerTools: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    attachButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34 },
    attachText: { color: c.primary, fontSize: 10, fontWeight: '800' },
    counter: { color: c.textMuted, fontSize: 10 },
    publishButton: { height: 37, borderRadius: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c.primary },
    publishText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    feedHeading: { marginBottom: 10 },
    feedTitle: { color: c.text, fontSize: 17, fontWeight: '900' },
    feedCaption: { color: c.textMuted, fontSize: 10, marginTop: 3 },
    post: { padding: 15, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 11 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceElevated },
    avatarInitial: { color: c.text, fontSize: 12, fontWeight: '900' },
    name: { color: c.text, fontSize: 12, fontWeight: '900' },
    handle: { color: c.primary, fontSize: 10, marginTop: 2 },
    time: { color: c.textMuted, fontSize: 9 },
    postContent: { color: c.text, fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 13 },
    postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 15, marginTop: 10, marginBottom: 12, backgroundColor: c.background },
    postActions: { flexDirection: 'row', alignItems: 'center', gap: 17, borderTopWidth: 1, borderTopColor: c.glassBorder, paddingTop: 11 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
    actionText: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
    ownLabel: { color: c.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
    comments: { borderTopWidth: 1, borderTopColor: c.glassBorder, marginTop: 10, paddingTop: 10 },
    comment: { paddingVertical: 6 },
    commentAuthor: { color: c.primary, fontSize: 10, fontWeight: '900' },
    commentText: { color: c.text, fontSize: 11, lineHeight: 16, marginTop: 2 },
    noComments: { color: c.textMuted, fontSize: 10, paddingVertical: 7 },
    commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    commentInput: { flex: 1, height: 40, borderRadius: 13, paddingHorizontal: 12, color: c.text, backgroundColor: c.background, fontSize: 11 },
    commentSend: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    empty: { alignItems: 'center', padding: 28, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, marginTop: 6 },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: '900', marginTop: 12 },
    emptyText: { color: c.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
    emptyButton: { marginTop: 14, paddingHorizontal: 16, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    emptyButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    storyViewer: { flex: 1, backgroundColor: '#08080C', justifyContent: 'center' },
    storyViewerImage: { width: '100%', height: '100%', position: 'absolute' },
    storyViewerTop: { position: 'absolute', top: 55, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    storyViewerPerson: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    storyViewerAvatar: { width: 38, height: 38, borderRadius: 19 },
    storyViewerAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#33333D', alignItems: 'center', justifyContent: 'center' },
    storyViewerInitial: { color: '#FFFFFF', fontWeight: '900' },
    storyViewerName: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    storyViewerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
    storyClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    storyCaption: { position: 'absolute', bottom: 80, left: 22, right: 22, color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
    storyViews: { position: 'absolute', bottom: 32, left: 22, color: '#FFFFFF', fontSize: 11, flexDirection: 'row', alignItems: 'center' },
  });
}
