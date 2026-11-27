ni yechganingizdan so‘ng natija test tarixingizga saqlanadi.</LocalizedText>
          </>
        ) : null}

        {phase === 'loading' ? (
          <View style={s.loadingCard}>
            <View style={s.loadingIcon}><Ionicons name="sparkles" size={30} color="#FFFFFF" /></View>
            <ActivityIndicator size="large" color={colors.primary} />
            <LocalizedText style={s.loadingTitle}>Test tayyorlanmoqda</LocalizedText>
            {progressPhase === 'uploading' ? <><LocalizedText style={s.muted}>Yuklash: {uploadProgress}%</LocalizedText><View style={s.progressTrack}><View style={[s.progressFill, { width: `${uploadProgress}%` }]} /></View></> : null}
            {([{ value: 'uploading', label: 'Fayl yuklanmoqda' }, { value: 'reading', label: 'Hujjat o‘qilmoqda' }, { value: 'generating', label: 'Savollar yaratilmoqda' }, { value: 'done', label: 'Tayyor' }] as const).map((item) => {
              const order = ['uploading', 'reading', 'generating', 'done'];
              const active = order.indexOf(progressPhase) >= order.indexOf(item.value);
              return <View key={item.value} style={s.savingRow}><Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={active ? colors.primary : colors.textMuted} /><LocalizedText style={s.muted}>{item.label}</LocalizedText></View>;
            })}
            <LocalizedText style={s.muted}>Jarayon tugaguncha ilovani yopmang.</LocalizedText>
            <Pressable onPress={cancelGeneration} style={s.secondaryButton}><LocalizedText style={s.secondaryButtonText}>Bekor qilish</LocalizedText></Pressable>
          </View>
        ) : null}

        {phase === 'review' ? (
          <>
            <View style={s.panel}>
              <LocalizedText style={s.panelTitle}>Savollarni ko‘rib chiqing</LocalizedText>
              <LocalizedText style={s.muted}>{file?.name} · {questions.length} ta savol. Testni boshlashdan oldin savollarni tahrirlashingiz, o‘chirishingiz yoki qayta yaratishingiz mumkin.</LocalizedText>
            </View>
            {questions.map((question, index) => (
              <View key={question.id} style={s.questionCard}>
                <LocalizedText style={s.questionNumber}>SAVOL {index + 1}</LocalizedText>
                {editingQuestionId === question.id && editDraft ? (
                  <>
                    <TextInput value={editDraft.question} onChangeText={(value) => setEditDraft((draft) => draft ? { ...draft, question: value } : draft)} multiline style={s.editInput} placeholder="Savol matni" placeholderTextColor={colors.textMuted} />
                    {editDraft.options.map((option, optionIndex) => (
                      <TextInput key={`${question.id}-edit-${optionIndex}`} value={option} onChangeText={(value) => setEditDraft((draft) => draft ? { ...draft, options: draft.options.map((item, i) => i === optionIndex ? value : item) } : draft)} style={s.editInput} placeholder={`Variant ${String.fromCharCode(65 + optionIndex)}`} placeholderTextColor={colors.textMuted} />
                    ))}
                    <TextInput value={editDraft.explanation} onChangeText={(value) => setEditDraft((draft) => draft ? { ...draft, explanation: value } : draft)} multiline style={s.editInput} placeholder="Izoh" placeholderTextColor={colors.textMuted} />
                    <View style={s.reviewActions}>
                      <Pressable onPress={saveQuestionEdit} style={s.reviewActionPrimary}><LocalizedText style={s.reviewActionPrimaryText}>Saqlash</LocalizedText></Pressable>
                      <Pressable onPress={() => { setEditingQuestionId(null); setEditDraft(null); }} style={s.reviewAction}><LocalizedText style={s.reviewActionText}>Bekor qilish</LocalizedText></Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <LocalizedText style={s.questionText}>{question.question}</LocalizedText>
                    {question.options.map((option, optionIndex) => <LocalizedText key={`${question.id}-${optionIndex}`} style={s.optionText}>{String.fromCharCode(65 + optionIndex)}. {option}{optionIndex === question.correctAnswer ? ' ✓' : ''}</LocalizedText>)}
                    <LocalizedText style={s.explanationText}>{question.explanation}</LocalizedText>
                    <View style={s.reviewActions}>
                      <Pressable onPress={() => beginQuestionEdit(question)} style={s.reviewAction}><LocalizedText style={s.reviewActionText}>Tahrirlash</LocalizedText></Pressable>
                      <Pressable onPress={() => void regenerateQuestion(question)} disabled={regeneratingQuestionId !== null} style={s.reviewAction}><LocalizedText style={s.reviewActionText}>{regeneratingQuestionId === question.id ? 'Yaratilmoqda…' : 'Qayta yaratish'}</LocalizedText></Pressable>
                      <Pressable onPress={() => deleteQuestion(question)} style={s.reviewAction}><LocalizedText style={s.reviewActionDanger}>O‘chirish</LocalizedText></Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}
            <Pressable onPress={startQuiz} disabled={!questions.length || editingQuestionId !== null} style={[s.primaryButton, (!questions.length || editingQuestionId !== null) && s.disabledButton]}>
              <LocalizedText style={s.primaryButtonText}>Testni boshlash ({questions.length} ta)</LocalizedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={() => void generate()} style={s.secondaryButton}><LocalizedText style={s.secondaryButtonText}>Butun testni qayta yaratish</LocalizedText></Pressable>
          </>
        ) : null}

        {phase === 'quiz' && currentQuestion ? (
          <>
            <View style={s.quizProgressHeader}>
              <LocalizedText style={s.eyebrow}>HUJJATDAN YARATILGAN TEST</LocalizedText>
              <LocalizedText style={s.progressText}>{questionIndex + 1} / {questions.length}</LocalizedText>
            </View>
            <View style={s.progressTrack}><View style={[s.progressFill, { width: `${((questionIndex + 1) / questions.length) * 100}%` }]} /></View>
            <View style={s.questionCard}>
              <LocalizedText style={s.questionNumber}>SAVOL {questionIndex + 1}</LocalizedText>
              <LocalizedText style={s.questionText}>{currentQuestion.question}</LocalizedText>
              <View style={s.options}>
                {currentQuestion.options.map((option, index) => {
                  const selected = selectedAnswer === index;
                  const isCorrect = selectedAnswer !== null && index === currentQuestion.correctAnswer;
                  const isWrong = selected && selectedAnswer !== currentQuestion.correctAnswer;
                  return (
                    <Pressable key={`${currentQuestion.id}-${index}`} onPress={() => selectedAnswer === null && setSelectedAnswer(index)} style={[s.option, selected && s.optionSelected, isCorrect && s.optionCorrect, isWrong && s.optionWrong]}>
                      <View style={[s.optionLetter, selected && s.optionLetterSelected]}><LocalizedText style={[s.optionLetterText, selected && s.optionLetterTextSelected]}>{String.fromCharCode(65 + index)}</LocalizedText></View>
                      <LocalizedText style={s.optionText}>{option}</LocalizedText>
                      {isCorrect ? <Ionicons name="checkmark-circle" size={20} color="#159B68" /> : isWrong ? <Ionicons name="close-circle" size={20} color="#DC4C64" /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {selectedAnswer !== null ? (
                <View style={s.explanationBox}>
                  <LocalizedText style={s.explanationTitle}>{selectedAnswer === currentQuestion.correctAnswer ? 'To‘g‘ri javob!' : 'Javobni o‘rganamiz'}</LocalizedText>
                  <LocalizedText style={s.explanationText}>{currentQuestion.explanation}</LocalizedText>
                </View>
              ) : null}
            </View>
            <Pressable onPress={nextQuestion} disabled={selectedAnswer === null} style={[s.primaryButton, selectedAnswer === null && s.disabledButton]}>
              <LocalizedText style={s.primaryButtonText}>{questionIndex + 1 === questions.length ? 'Natijani ko‘rish' : 'Keyingi savol'}</LocalizedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}

        {phase === 'result' ? (
          <View style={s.resultCard}>
            <View style={s.resultIcon}><Ionicons name={percentage >= 70 ? 'trophy' : 'school'} size={34} color="#FFFFFF" /></View>
            <LocalizedText style={s.resultEyebrow}>TEST YAKUNLANDI</LocalizedText>
            <LocalizedText style={s.resultTitle}>{percentage >= 70 ? 'Ajoyib natija!' : 'Mashq qilishda davom eting!'}</LocalizedText>
            <LocalizedText style={s.resultPercent}>{percentage}%</LocalizedText>
            <LocalizedText style={s.muted}>{correctCount} ta to‘g‘ri javob · {questions.length - correctCount} ta xato</LocalizedText>
            <View style={s.resultTrack}><View style={[s.resultFill, { width: `${percentage}%` }]} /></View>
            {savingHistory ? (
              <View style={s.savingRow}><ActivityIndicator size="small" color={colors.primary} /><LocalizedText style={s.muted}>Natija tarixga saqlanmoqda...</LocalizedText></View>
            ) : (
              <View style={s.savedRow}><Ionicons name="checkmark-circle" size={17} color="#159B68" /><LocalizedText style={s.savedText}>Natija test tarixiga saqlandi</LocalizedText></View>
            )}
            {questions.some((question, index) => answers[index] !== question.correctAnswer) ? (
              <View style={s.panel}>
                <LocalizedText style={s.panelTitle}>Xatolar tahlili</LocalizedText>
                {questions.map((question, index) => answers[index] === question.correctAnswer ? null : (
                  <View key={question.id} style={s.explanationBox}>
                    <LocalizedText style={s.explanationTitle}>Savol {index + 1}</LocalizedText>
                    <LocalizedText style={s.questionText}>{question.question}</LocalizedText>
                    <LocalizedText style={s.explanationText}>To‘g‘ri javob: {question.options[question.correctAnswer]}</LocalizedText>
                    <LocalizedText style={s.explanationText}>{question.explanation}</LocalizedText>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable onPress={() => void generate()} style={s.primaryButton}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <LocalizedText style={s.primaryButtonText}>Testni qayta yaratish</LocalizedText>
            </Pressable>
            <Pressable onPress={reset} style={s.secondaryButton}><LocalizedText style={s.secondaryButtonText}>Boshqa hujjat tanlash</LocalizedText></Pressable>
            <Pressable onPress={onBack} style={s.secondaryButton}><LocalizedText style={s.secondaryButtonText}>Darslarga qaytish</LocalizedText></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { minHeight: 72, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    headerCopy: { flex: 1 },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
    headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B55D9' },
    content: { padding: 17, paddingBottom: 132, gap: 15 },
    hero: { overflow: 'hidden', borderRadius: 24, padding: 20, backgroundColor: '#21133F', gap: 10 },
    heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -90, top: -100, backgroundColor: 'rgba(171,137,255,0.20)' },
    heroTitle: { color: '#FFFFFF', fontSize: 22, lineHeight: 29, fontWeight: '900', maxWidth: 300 },
    heroText: { color: '#D9D0F3', fontSize: 12, lineHeight: 19 },
    formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
    formatChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.12)' },
    formatText: { color: '#F4F0FF', fontSize: 9, fontWeight: '900' },
    uploadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    uploadIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
    uploadCopy: { flex: 1, gap: 4 },
    uploadTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    muted: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
    panel: { borderRadius: 20, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 13 },
    panelTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    settingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
    countValue: { color: colors.primary, fontSize: 13, fontWeight: '900' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    stepTrack: { flex: 1, height: 7, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
    stepFill: { height: '100%', borderRadius: 6, backgroundColor: colors.primary },
    difficultyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    difficultyButton: { flex: 1, minWidth: '22%', borderRadius: 11, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
    difficultyActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
    difficultyText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
    difficultyTextActive: { color: colors.primary, fontWeight: '900' },
    editInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.surfaceElevated, fontSize: 12 },
    reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
    reviewAction: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
    reviewActionText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
    reviewActionDanger: { color: '#DC4C64', fontSize: 10, fontWeight: '800' },
    reviewActionPrimary: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.primary },
    reviewActionPrimaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 17, backgroundColor: '#6653D8', paddingHorizontal: 16 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    disabledButton: { opacity: 0.45 },
    footerNote: { color: colors.textMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 15 },
    loadingCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 22, padding: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    loadingIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#6653D8', alignItems: 'center', justifyContent: 'center' },
    loadingTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    quizProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    progressTrack: { height: 6, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.primary },
    questionCard: { borderRadius: 25, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 14 },
    questionNumber: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
    questionText: { color: colors.text, fontSize: 18, lineHeight: 27, fontWeight: '800' },
    options: { gap: 9 },
    option: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '13' },
    optionCorrect: { borderColor: '#159B68', backgroundColor: 'rgba(21,155,104,0.10)' },
    optionWrong: { borderColor: '#DC4C64', backgroundColor: 'rgba(220,76,100,0.10)' },
    optionLetter: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
    optionLetterSelected: { backgroundColor: colors.primary },
    optionLetterText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
    optionLetterTextSelected: { color: '#FFFFFF' },
    optionText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    explanationBox: { borderRadius: 14, padding: 12, backgroundColor: colors.primary + '12', gap: 5 },
    explanationTitle: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    explanationText: { color: colors.text, fontSize: 11, lineHeight: 17 },
    resultCard: { alignItems: 'center', borderRadius: 24, padding: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 11 },
    resultIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: '#6653D8', alignItems: 'center', justifyContent: 'center' },
    resultEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
    resultTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
    resultPercent: { color: colors.primary, fontSize: 42, fontWeight: '900' },
    resultTrack: { width: '100%', height: 8, borderRadius: 8, backgroundColor: colors.border, overflow: 'hidden', marginTop: 5 },
    resultFill: { height: '100%', backgroundColor: '#159B68' },
    savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 7 },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginVertical: 7 },
    savedText: { color: '#159B68', fontSize: 11, fontWeight: '800' },
    secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
    secondaryButtonText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  });
}
