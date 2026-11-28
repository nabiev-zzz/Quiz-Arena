import type { ThemeMode } from './tokens';
const shared = {
 spacing:{xs:4,sm:8,md:12,lg:16,xl:20,'2xl':24,'3xl':32,'4xl':40,'5xl':48},
 radius:{control:12,input:14,card:20,cardLarge:26,sheet:28,pill:999},
 type:{display:{size:32,lineHeight:39,weight:'800',letterSpacing:-0.8},title1:{size:26,lineHeight:32,weight:'800',letterSpacing:-0.6},title2:{size:21,lineHeight:27,weight:'750',letterSpacing:-0.35},headline:{size:17,lineHeight:23,weight:'700',letterSpacing:-0.2},body:{size:15,lineHeight:22,weight:'400',letterSpacing:0},bodySmall:{size:13,lineHeight:19,weight:'400',letterSpacing:0},caption:{size:12,lineHeight:16,weight:'500',letterSpacing:0.1},overline:{size:11,lineHeight:14,weight:'700',letterSpacing:1.1},button:{size:14,lineHeight:18,weight:'700',letterSpacing:0.1},tab:{size:11,lineHeight:14,weight:'650',letterSpacing:0}},
 motion:{fast:140,base:220,slow:320,stagger:45,pressScale:0.97},touchTarget:44,
} as const;
const light={background:'#F5F8F4',backgroundSecondary:'#EAF1E9',surface:'#FFFFFF',surfaceElevated:'#FFFFFF',surfaceTint:'#F5E9E9',border:'#E2EAE1',divider:'#EAF0E8',text:'#202B24',textSecondary:'#59685D',textMuted:'#7D8C80',textDisabled:'#A6A3B2',primary:'#A8324B',primaryPressed:'#84243A',onPrimary:'#FFFFFF',primarySoft:'#F6E8EA',success:'#287D59',successSurface:'#E6F3EA',warning:'#98610A',warningSurface:'#FFF3D9',error:'#B4233B',errorSurface:'#FDECEF',info:'#2366A8',infoSurface:'#EAF3FC',gold:'#9A6A16',goldSurface:'#FBF2D9',overlay:'rgba(15,12,30,0.48)',glassFill:'rgba(255,255,255,0.84)',glassBorder:'rgba(168,50,75,0.14)',input:'#FBFAFD',disabled:'#E7E5ED'} as const;
const dark={background:'#091410',backgroundSecondary:'#102019',surface:'#15241D',surfaceElevated:'#1D2D24',surfaceTint:'#33232A',border:'#2B4032',divider:'#25382B',text:'#F7F8F3',textSecondary:'#C5D2C8',textMuted:'#91A69A',textDisabled:'#686D83',primary:'#E5B95C',primaryPressed:'#B78332',onPrimary:'#FFFFFF',primarySoft:'#3A3020',success:'#65C99A',successSurface:'#17382A',warning:'#F0C36A',warningSurface:'#3A3020',error:'#FF7D91',errorSurface:'#3C202B',info:'#82BFFF',infoSurface:'#1D3048',gold:'#F4D98F',goldSurface:'#3A301F',overlay:'rgba(2,4,12,0.76)',glassFill:'rgba(24,30,48,0.88)',glassBorder:'rgba(193,218,198,0.17)',input:'#11172A',disabled:'#343B50'} as const;
export const communityTokens={
 light:{...shared,colors:light,shadows:{card:{color:'#26304A',opacity:0.07,radius:18,offset:{width:0,height:7},elevation:3},raised:{color:'#26304A',opacity:0.11,radius:24,offset:{width:0,height:10},elevation:5}},gradients:{hero:['#84243A','#C99A43'] as const}},
 dark:{...shared,colors:dark,shadows:{card:{color:'#000000',opacity:0.18,radius:16,offset:{width:0,height:6},elevation:2},raised:{color:'#000000',opacity:0.26,radius:20,offset:{width:0,height:9},elevation:4}},gradients:{hero:['#1A3024','#805D2B'] as const}},
} as const;
export type CommunityTheme=(typeof communityTokens)[ThemeMode];
export type CommunityColors=CommunityTheme['colors'];
