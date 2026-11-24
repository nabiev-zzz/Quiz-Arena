export interface ProfileAchievement {
  id: string;
  title: string;
  description: string;
  icon: 'star' | 'flash' | 'trophy' | 'medal' | 'school';
  unlocked: boolean;
}

export function getProfileAchievements(xp: number, level: number, rankPoints: number): ProfileAchievement[] {
  return [
    { id: 'first-xp', title: 'Birinchi qadam', description: 'Birinchi XP ochkosi', icon: 'star', unlocked: xp >= 1 },
    { id: 'xp-100', title: 'Tajriba yig‘uvchi', description: '100 XP to‘plang', icon: 'flash', unlocked: xp >= 100 },
    { id: 'level-5', title: 'Taraqqiyot', description: '5-darajaga chiqing', icon: 'school', unlocked: level >= 5 },
    { id: 'silver-rank', title: 'Kuchli raqib', description: 'Silver ligasiga chiqing', icon: 'medal', unlocked: rankPoints >= 200 },
    { id: 'diamond-rank', title: 'Olmos daraja', description: 'Diamond ligasiga chiqing', icon: 'trophy', unlocked: rankPoints >= 800 },
  ];
}
