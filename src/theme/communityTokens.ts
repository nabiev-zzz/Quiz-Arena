import type { ThemeMode } from './tokens';
const shared = {
 spacing:{xs:4,sm:8,md:12,lg:16,xl:20,'2xl':24,'3xl':32,'4xl':40,'5xl':48},
 radius:{control:12,input:14,card:20,cardLarge:26,sheet:28,pill:999},
 type:{display:{size:32,lineHeight:39,weight:'800',letterSpacing:-0.8},title1:{size:26,lineHeight:32,weight:'800',letterSpacing:-0.6},title2:{size:21,lineHeight:27,weight:'750',letterSpacing:-0.35},headline:{size:17,lineHeight:23,weight:'700',letterSpacing:-0.2},body:{size:15,lineHeight:22,weight:'400',letterSpacing:0},bodySmall:{size:13,lineHeight:19,weight:'400',letterSpacing:0},caption:{size:12,lineHeight:16,weight:'500',letterSpacing:0.1},overline:{size:11,lineHeight:14,weight:'700',letterSpacing:1.1},button:{size:14,lineHeight:18,weight:'700',letterSpacing:0.1},tab:{size:11,lineHeight:14,weight:'650',letterSpacing:0}},
 motion:{fast:140,base:220,slow:320,stagger:45,pressScale:0.97},touchTarget:44,
} as const;
const light={background:'#F2F7FC',backgroundSecondary:'#E7F0F8',surface:'#FFFFFF',surfaceElevated:'#FFFFFF',surfaceTint:'#EAF4FB',border:'#D8E5F0',divider:'#E7EFF6',text:'#172638',textSecondary:'#4F6277',textMuted:'#74879A',textDisabled:'#9AA9B8',primary:'#347EA9',primaryPressed:'#245D80',onPrimary:'#FFFFFF',primarySoft:'#E5F2FA',success:'#258A69',successSurface:'#E4F4EE',warning:'#9A741F',warningSurface:'#FBF3DE',error:'#B4233B',errorSurface:'#FDECEF',info:'#347EA9',infoSurface:'#E7F2FA',gold:'#9A741F',goldSurface:'#FBF3DE',overlay:'rgba(8,19,33,0.42)',glassFill:'rgba(255,255,255,0.86)',glassBorder:'rgba(52,126,169,0.16)',input:'#FBFDFF',disabled:'#E3EAF1'} as const;
const dark={background:'#081321',backgroundSecondary:'#0D1B2D',surface:'#122238',surfaceElevated:'#192C45',surfaceTint:'#1B3651',border:'#2B4561',divider:'#203850',text:'#F4F8FC',textSecondary:'#C4D0DD',textMuted:'#8FA2B8',textDisabled:'#657A91',primary:'#9AD8FF',primaryPressed:'#4D9CCB',onPrimary:'#092035',primarySoft:'#17354E',success:'#78D6B0',successSurface:'#173B36',warning:'#E8C77A',warningSurface:'#3A3425',error:'#FF8799',errorSurface:'#3C202B',info:'#9AD8FF',infoSurface:'#18344D',gold:'#E8C77A',goldSurface:'#3A3425',overlay:'rgba(4,10,20,0.78)',glassFill:'rgba(18,34,56,0.88)',glassBorder:'rgba(173,205,235,0.18)',input:'#0D1B2D',disabled:'#34465B'} as const;
export const communityTokens={
 light:{...shared,colors:light,shadows:{card:{color:'#26384B',opacity:0.07,radius:18,offset:{width:0,height:7},elevation:3},raised:{color:'#26384B',opacity:0.11,radius:24,offset:{width:0,height:10},elevation:5}},gradients:{hero:['#245D80','#9AD8FF'] as const}},
 dark:{...shared,colors:dark,shadows:{card:{color:'#000000',opacity:0.18,radius:16,offset:{width:0,height:6},elevation:2},raised:{color:'#000000',opacity:0.26,radius:20,offset:{width:0,height:9},elevation:4}},gradients:{hero:['#122238','#347EA9'] as const}},
} as const;
export type CommunityTheme=(typeof communityTokens)[ThemeMode];
export type CommunityColors=CommunityTheme['colors'];
