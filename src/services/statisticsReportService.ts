import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { LearningStats } from './learningService';
import type { BattleStats } from './battleService';
import type { SubscriptionTier } from './subscriptionService';

export interface StatisticsReportUser {
  displayName?: string | null;
  username?: string | null;
  level?: number | null;
  xp?: number | null;
  rankPoints?: number | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
  return number(value).toLocaleString('uz-UZ');
}

export function buildStatisticsReportHtml(input: {
  user: StatisticsReportUser;
  learning: LearningStats | null;
  battle: BattleStats | null;
  tier: SubscriptionTier;
}): string {
  const { user, learning, battle, tier } = input;
  const includeDetails = tier !== 'free';
  const name = escapeHtml(user.displayName || (user.username ? '@' + user.username : 'QUIZ ARENA foydalanuvchisi'));
  const subjects = (learning?.subjectBreakdown ?? []).map((item) => `
    <tr><td>${escapeHtml(item.subjectName)}</td><td>${formatNumber(item.attempts)}</td><td>${formatNumber(item.correctAnswers)}/${formatNumber(item.totalQuestions)}</td><td>${number(item.accuracy).toFixed(1)}%</td></tr>
  `).join('');
  const attempts = (learning?.recentAttempts ?? []).slice(0, 10).map((item) => `
    <tr><td>${escapeHtml(item.subjectName)}</td><td>${escapeHtml(item.topicName)}</td><td>${formatNumber(item.correctAnswers)}/${formatNumber(item.totalQuestions)}</td><td>${number(item.accuracy).toFixed(0)}%</td><td>${escapeHtml(new Date(item.completedAt).toLocaleDateString('uz-UZ'))}</td></tr>
  `).join('');
  const recentMatches = Array.isArray(battle?.recentMatches)
    ? (battle.recentMatches as Array<{ mode?: string; result?: string; myScore?: number; finishedAt?: string | null }>).slice(0, 10)
    : [];
  const matches = recentMatches.map((item) => `
    <tr><td>${escapeHtml(item.mode === 'ranked' ? 'Ranked' : 'Casual')}</td><td>${escapeHtml(item.result === 'win' ? 'G‘alaba' : item.result === 'loss' ? 'Mag‘lubiyat' : 'Durang')}</td><td>${formatNumber(item.myScore)}</td><td>${escapeHtml(item.finishedAt ? new Date(item.finishedAt).toLocaleDateString('uz-UZ') : '—')}</td></tr>
  `).join('');
  const generatedAt = new Date().toLocaleString('uz-UZ');
  const documentTitle = `QUIZ ARENA - ${name} - Statistika`;
  const hasLearning = Boolean(learning);
  const hasBattle = Boolean(battle);

  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${documentTitle}</title>
<style>
@page { size: A4; margin: 22mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Arial, "DejaVu Sans", sans-serif; color: #211B35; margin: 0; font-size: 11px; line-height: 1.55; user-select: text; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hero { background: #21133F; color: #fff; padding: 24px; border-radius: 16px; }
.brand { color: #C9B7FF; font-size: 10px; font-weight: 800; letter-spacing: 2px; }
h1 { font-size: 25px; margin: 8px 0 4px; }
.muted { color: #786F8E; }
.hero .muted { color: #D4C9F2; }
h2 { font-size: 15px; margin: 24px 0 10px; color: #4C3386; }
.grid { display: table; width: 100%; border-spacing: 7px; margin: 12px -7px 0; }
.metric { display: table-cell; width: 25%; background: #F4F0FF; padding: 12px; border-radius: 10px; }
.metric strong { display: block; font-size: 19px; color: #5637A5; }
.metric span { color: #786F8E; font-size: 9px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { text-align: left; background: #F0EBFC; color: #51378D; font-size: 9px; }
th, td { padding: 8px 7px; border-bottom: 1px solid #E9E3F5; vertical-align: top; }
.footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #E9E3F5; color: #8B829D; font-size: 9px; }
.empty { padding: 12px; border: 1px dashed #D8CDEA; border-radius: 10px; color: #786F8E; }
@media print {
  html, body { background: #FFFFFF !important; }
  .hero, .metric, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { break-after: avoid; page-break-after: avoid; }
  tr, .metric, .hero { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  a { color: inherit; text-decoration: none; }
}
</style>
</head>
<body>
  <div class="hero">
    <div class="brand">QUIZ ARENA · PERSONAL REPORT</div>
    <h1>Shaxsiy statistika hisoboti</h1>
    <div>${name}</div>
    <div class="muted">Yaratilgan vaqt: ${escapeHtml(generatedAt)}</div>
  </div>

  <h2>Profil ko‘rsatkichlari</h2>
  <div class="grid">
    <div class="metric"><strong>${formatNumber(user.level)}</strong><span>Daraja</span></div>
    <div class="metric"><strong>${formatNumber(user.xp)}</strong><span>XP</span></div>
    <div class="metric"><strong>${formatNumber(user.rankPoints)}</strong><span>Rank ochkolari</span></div>
    <div class="metric"><strong>${formatNumber(learning?.accuracy ?? 0)}%</strong><span>Test aniqligi</span></div>
  </div>

  <h2>Ta’lim statistikasi</h2>
  ${hasLearning ? `
    <div class="grid">
      <div class="metric"><strong>${formatNumber(learning?.totalAttempts)}</strong><span>Yakunlangan test</span></div>
      <div class="metric"><strong>${formatNumber(learning?.totalQuestions)}</strong><span>Jami savollar</span></div>
      <div class="metric"><strong>${formatNumber(learning?.correctAnswers)}</strong><span>To‘g‘ri javoblar</span></div>
      <div class="metric"><strong>${number(learning?.accuracy).toFixed(1)}%</strong><span>Aniqlik</span></div>
    </div>
    <table><thead><tr><th>Fan</th><th>Testlar</th><th>To‘g‘ri</th><th>Aniqlik</th></tr></thead><tbody>${includeDetails ? (subjects || '<tr><td colspan="4">Fan statistikasi hozircha yo‘q.</td></tr>') : '<tr><td colspan="4">Batafsil fan tahlili PREMIUM tarifida mavjud.</td></tr>'}</tbody></table>
    <h2>So‘nggi testlar</h2>
    <table><thead><tr><th>Fan</th><th>Mavzu</th><th>Natija</th><th>Aniqlik</th><th>Sana</th></tr></thead><tbody>${includeDetails ? (attempts || '<tr><td colspan="5">Test tarixi hozircha yo‘q.</td></tr>') : '<tr><td colspan="5">So‘nggi testlar tafsiloti PREMIUM tarifida mavjud.</td></tr>'}</tbody></table>
  ` : '<div class="empty">Ta’lim statistikasi hali mavjud emas.</div>'}

  <h2>Battle statistikasi</h2>
  ${hasBattle ? `
    <div class="grid">
      <div class="metric"><strong>${formatNumber(battle?.totalMatches)}</strong><span>Jami Battle</span></div>
      <div class="metric"><strong>${formatNumber(battle?.wins)}</strong><span>G‘alabalar</span></div>
      <div class="metric"><strong>${formatNumber(battle?.losses)}</strong><span>Mag‘lubiyatlar</span></div>
      <div class="metric"><strong>${number(battle?.winRate).toFixed(1)}%</strong><span>G‘alaba foizi</span></div>
    </div>
    <table><thead><tr><th>Rejim</th><th>Natija</th><th>Ball</th><th>Sana</th></tr></thead><tbody>${includeDetails ? (matches || '<tr><td colspan="4">Battle tarixi hozircha yo‘q.</td></tr>') : '<tr><td colspan="4">Battle tarixi tafsiloti PREMIUM tarifida mavjud.</td></tr>'}</tbody></table>
  ` : '<div class="empty">Battle statistikasi hali mavjud emas.</div>'}

  <div class="footer">Ushbu hisobot QUIZ ARENA hisobingizdagi shaxsiy natijalardan yaratildi. Hisobot faqat sizga tegishli ma’lumotlarni o‘z ichiga oladi.</div>
</body>
</html>`;
}

export async function shareStatisticsPdf(input: {
  user: StatisticsReportUser;
  learning: LearningStats | null;
  battle: BattleStats | null;
  tier: SubscriptionTier;
}): Promise<void> {
  const html = buildStatisticsReportHtml(input);

  if (Platform.OS === 'web') {
    // Browser-native print-to-PDF keeps HTML text and tables selectable/searchable.
    // No screenshot, canvas capture, or raster image is used.
    await Print.printAsync({ html, width: 595, height: 842 });
    return;
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Bu qurilmada fayl ulashish imkoniyati mavjud emas.');
  }

  const file = await Print.printToFileAsync({ html, width: 595, height: 842 });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: '.pdf',
    dialogTitle: 'QUIZ ARENA statistikasi',
  });
}
