export const leaderboardTheme = {
  ocean: ['#17112F', '#30205C', '#111A36'] as const,
  cyan: '#62D8D0', indigo: '#9B83FF', teal: '#56D7B2',
  gold: '#F8D477', silver: '#D7E5F5', bronze: '#D99A70',
  success: '#4ADE80', muted: 'rgba(255,255,255,0.66)',
  glass: 'rgba(255,255,255,0.09)',
  radius: { card: 28, row: 22 },
  spring: { damping: 13, stiffness: 150, mass: 0.72 },
} as const;

export type LeaderboardPeriod = 'Haftalik' | 'Oylik' | 'Hammasi';
export type LeaderboardUser = { id: string; name: string; xp: number; rank: string; change: number };

// Replace this array with API data when the real ranking endpoint is ready.
export const leaderboardMockData: LeaderboardUser[] = [
  { id: 'u1', name: 'Azizbek', xp: 2480, rank: 'Grandmaster', change: 2 },
  { id: 'u2', name: 'Madina', xp: 2310, rank: 'Master', change: 1 },
  { id: 'u3', name: 'Jasur', xp: 2190, rank: 'Diamond', change: -1 },
  { id: 'u4', name: 'Siz', xp: 1980, rank: 'Diamond', change: 3 },
  { id: 'u5', name: 'Shahzoda', xp: 1840, rank: 'Platinum', change: 0 },
  { id: 'u6', name: 'Bekzod', xp: 1720, rank: 'Platinum', change: 1 },
  { id: 'u7', name: 'Diyor', xp: 1590, rank: 'Gold', change: -2 },
  { id: 'u8', name: 'Malika', xp: 1430, rank: 'Gold', change: 4 },
  { id: 'u9', name: 'Sardor', xp: 1270, rank: 'Silver', change: 0 },
  { id: 'u10', name: 'Nilufar', xp: 1110, rank: 'Silver', change: -1 },
  { id: 'u11', name: 'Umid', xp: 980, rank: 'Bronze', change: 2 },
];
