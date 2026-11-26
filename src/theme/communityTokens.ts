import type { ThemeMode } from './tokens';
const shared = {
 spacing:{xs:4,sm:8,md:12,lg:16,xl:20,'2xl':24,'3xl':32,'4xl':40,'5xl':48},
 radius:{control:12,input:14,card:20,cardLarge:26,sheet:28,pill:999},
 type:{display:{size:32,lineHeight:39,weight:'800',letterSpacing:-0.8},title1:{size:26,lineHeight:32,weight:'800',letterSpacing:-0.6},title2:{size:21,lineHeight:27,weight:'750',letterSpacing:-0.35},headline:{size:17,lineHeight:23,weight:'700',letterSpacing:-0.2},body:{size:15,lineHeight:22,weight:'400',letterSpacing:0},bodySmall:{size:13,lineHeight:19,weight:'400',letterSpacing:0},caption:{size:12,lineHeight:16,weight:'500',letterSpacing:0.1},overline:{size:11,lineHeight:14,weight:'700',letterSpacing:1.1},button:{size:14,lineHeight:18,weight:'700',letterSpacing:0.1},tab:{size:11,lineHeight:14,weight:'650',letterSpacing:0}},
 motion:{fast:140,base:220,slow:320,stagger:45,pressScale:0.97},touchTarget:44,
} as const;
const light={background:'#F7F7FC',backgroundSecondary:'#F0EFF8',surface:'#FFFFFF',surfaceElevated:'#FFFFFF',surfaceTint:'#F1EDFB',border:'#E7E4EF',divider:'#EEEAF4',text:'#19172A',textSecondary:'#555267',textMuted:'#777489',textDisabled:'#A6A3B2',primary:'#6941C6',primaryPressed:'#5230A6',onPrimary:'#FFFFFF',primarySoft:'#EEE8FB',success:'#087B59',successSurface:'#E4F5EE',warning:'#98610A',warningSurface:'#FFF3D9',error:'#B4233B',errorSurface:'#FDECEF',info:'#2366A8',infoSurface:'#EAF3FC',gold:'#946200',goldSurface:'#FFF5D8',overlay:'rgba(15,12,30,0.48)',glassFill:'rgba(255,255,255,0.84)',glassBorder:'rgba(105,65,198,0.14)',input:'#FBFAFD',disabled:'#E7E5ED'} as const;
const dark={background:'#0D1020',backgroundSecondary:'#13182A',surface:'#171D30',surfaceElevated:'#202840',surfaceTint:'#25203B',border:'#2A3148',divider:'#252C40',text:'#F6F5FC',textSecondary:'#C4C5D4',textMuted:'#9A9DB2',textDisabled:'#686D83',primary:'#6941C6',primaryPressed:'#5230A6',onPrimary:'#FFFFFF',primarySoft:'#2B2343',success:'#55D6A5',successSurface:'#16382F',warning:'#F0C36A',warningSurface:'#3A3020',error:'#FF7D91',errorSurface:'#3C202B',info:'#82BFFF',infoSurface:'#1D3048',gold:'#E8BE62',goldSurface:'#3A301F',overlay:'rgba(2,4,12,0.76)',glassFill:'rgba(24,30,48,0.88)',glassBorder:'rgba(190,174,255,0.18)',input:'#11172A',disabled:'#343B50'} as const;
export const communityTokens={
 light:{...shared,colors:light,shadows:{card:{color:'#26304A',opacity:0.07,radius:18,offset:{width:0,height:7},elevation:3},raised:{color:'#26304A',opacity:0.11,radius:24,offset:{width:0,height:10},elevation:5}},gradients:{hero:['#30205F','#6941C6'] as const}},
 dark:{...shared,colors:dark,shadows:{card:{color:'#000000',opacity:0.18,radius:16,offset:{width:0,height:6},elevation:2},raised:{color:'#000000',opacity:0.26,radius:20,offset:{width:0,height:9},elevation:4}},gradients:{hero:['#21183F','#51339C'] as const}},
} as const;
export type CommunityTheme=(typeof communityTokens)[ThemeMode];
export type CommunityColors=CommunityTheme['colors'];
