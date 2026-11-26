import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../i18n/LocalizedText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

export default function ProfileEditScreen({ onBack, onCollectionPress }: { onBack: () => void; onCollectionPress: () => void }) {
  const { user, updateProfile, refreshUser } = useAuth();
  const { tokens, isDark } = useTheme();
  const c = tokens.colors;
  const s = makeStyles(c, isDark);
  const [name, setName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(user?.displayName ?? ''); setUsername(user?.username ?? '');
    setBio(user?.bio ?? ''); setAvatar(user?.avatarUrl ?? null);
  }, [user?.id, user?.displayName, user?.username, user?.bio, user?.avatarUrl]);
  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { showLocalizedAlert('Ruxsat kerak', 'Avatar tanlash uchun galereyaga ruxsat bering.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.45, base64: true });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64 || asset.base64.length > 850_000) { showLocalizedAlert('Rasm juda katta', 'Boshqa yoki kichikroq rasm tanlang.'); return; }
      const mime = asset.mimeType === 'image/png' ? 'image/png' : asset.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
      setAvatar(`data:${mime};base64,${asset.base64}`);
    } catch (error) { showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Rasm tanlanmadi.'); }
  };
  const save = async () => {
    if (!user || saving) return;
    if (name.trim().length < 2) { showLocalizedAlert('Xatolik', 'Ism kamida 2 ta belgidan iborat bo‘lsin.'); return; }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) { showLocalizedAlert('Xatolik', 'Username 3–30 belgi bo‘lsin. Faqat harf, raqam va _ ishlating.'); return; }
    setSaving(true);
    try {
      await updateProfile({ displayName: name.trim(), username: username.trim(), bio: bio.trim() || null, ...(avatar !== user.avatarUrl ? { avatarUrl: avatar } : {}) });
      await refreshUser(); showLocalizedAlert('Saqlandi', 'Profil ma’lumotlari yangilandi.');
    } catch (error) { showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Profilni saqlab bo‘lmadi.'); }
    finally { setSaving(false); }
  };
  const initials = name.trim().split(/\\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  return <View style={s.screen}>
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.back}><Ionicons name="arrow-back" size={22} color={c.text} /></Pressable>
      <View style={{ flex: 1 }}><LocalizedText style={s.eyebrow}>SHAXSIY MA’LUMOTLAR</LocalizedText><LocalizedText style={s.title}>Profilni tahrirlash</LocalizedText></View>
      <View style={s.headerIcon}><Ionicons name="person-circle-outline" size={23} color={c.primary} /></View>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.hero}><LocalizedText style={s.heroEyebrow}>ZELQEN CORE · PROFIL</LocalizedText>
        <View style={s.avatarWrap}>{avatar ? <Image source={{ uri: avatar }} style={s.avatar} /> : <LocalizedText style={s.initials}>{initials || 'U'}</LocalizedText>}
          <Pressable onPress={() => void pickAvatar()} style={s.camera}><Ionicons name="camera" size={17} color="#FFFFFF" /></Pressable>
        </View>
        <LocalizedText style={s.heroName}>{name || 'Ismingiz'}</LocalizedText><LocalizedText style={s.heroUsername}>@{username || 'username'}</LocalizedText>
        <LocalizedText style={s.heroHint}>Profilingiz boshqalarga shunday ko‘rinadi</LocalizedText>
      </View>
      <View style={s.sectionHeading}><LocalizedText style={s.sectionTitle}>Asosiy ma’lumotlar</LocalizedText><LocalizedText style={s.caption}>Istalgan vaqtda yangilashingiz mumkin</LocalizedText></View>
      <View style={s.form}>
        <LocalizedText style={s.label}>Ism va familiya</LocalizedText>
        <View style={s.inputWrap}><Ionicons name="person-outline" size={18} color={c.textMuted} /><LocalizedTextInput style={s.input} value={name} onChangeText={setName} placeholder="Ismingiz" placeholderTextColor={c.textMuted} maxLength={100} /></View>
        <LocalizedText style={s.label}>Username</LocalizedText>
        <View style={s.inputWrap}><LocalizedText style={s.at}>@</LocalizedText><LocalizedTextInput style={s.input} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor={c.textMuted} autoCapitalize="none" autoCorrect={false} maxLength={30} /></View>
        <LocalizedText style={s.helper}>3–30 belgi: lotin harflari, raqamlar va pastki chiziq.</LocalizedText>
        <LocalizedText style={s.label}>Bio · O‘zingiz haqingizda</LocalizedText>
        <View style={[s.inputWrap, s.bioWrap]}><Ionicons name="document-text-outline" size={18} color={c.textMuted} style={{ marginTop: 3 }} /><LocalizedTextInput style={[s.input, s.bioInput]} value={bio} onChangeText={setBio} placeholder="Qiziqishlaringiz va maqsadlaringiz..." placeholderTextColor={c.textMuted} multiline maxLength={500} /></View>
        <LocalizedText style={s.counter}>{bio.length}/500</LocalizedText>
      </View>
      <View style={s.sectionHeading}><LocalizedText style={s.sectionTitle}>Profil bezaklari</LocalizedText><LocalizedText style={s.caption}>Sotib olgan buyumlaringizni boshqaring</LocalizedText></View>
      <Pressable onPress={onCollectionPress} style={s.collection}>
        <View style={s.collectionIcon}><Ionicons name="albums-outline" size={23} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}><LocalizedText style={s.collectionTitle}>Mening kolleksiyam</LocalizedText><LocalizedText style={s.collectionDescription}>Ramkalar, nishonlar va avatar bezaklarini ko‘rish hamda jihozlash</LocalizedText></View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </Pressable>
      <Pressable onPress={() => void save()} disabled={saving} style={[s.save, saving && { opacity: 0.6 }]}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" /><LocalizedText style={s.saveText}>O‘zgarishlarni saqlash</LocalizedText></>}
      </Pressable>
      <LocalizedText style={s.footer}>Ma’lumotlaringiz hisobingiz bilan xavfsiz bog‘langan.</LocalizedText>
    </ScrollView>
  </View>;
}
function makeStyles(c: ReturnType<typeof useTheme>['tokens']['colors'], dark: boolean) {
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.background},header:{minHeight:68,paddingHorizontal:17,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:c.border},back:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:c.surface},eyebrow:{color:c.textMuted,fontSize:9,fontWeight:'900',letterSpacing:1.5},title:{color:c.text,fontSize:19,fontWeight:'900',marginTop:2},headerIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#29213D':'#F0EBFF'},content:{padding:17,paddingBottom:120},
    hero:{alignItems:'center',borderRadius:25,paddingVertical:20,paddingHorizontal:15,backgroundColor:dark?'#211A36':'#F0EBFF',borderWidth:1,borderColor:dark?'#49366B':'#DDD3FF',marginBottom:23},heroEyebrow:{color:c.primary,fontSize:9,fontWeight:'900',letterSpacing:1.6},avatarWrap:{width:94,height:94,borderRadius:47,marginTop:14,marginBottom:8,backgroundColor:c.surface,borderWidth:3,borderColor:c.primary,alignItems:'center',justifyContent:'center',padding:4},avatar:{width:'100%',height:'100%',borderRadius:44},initials:{color:c.text,fontSize:29,fontWeight:'900'},camera:{position:'absolute',right:-3,bottom:-1,width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:c.primary,borderWidth:3,borderColor:dark?'#211A36':'#F0EBFF'},heroName:{color:c.text,fontSize:17,fontWeight:'900',marginTop:5},heroUsername:{color:c.textMuted,fontSize:11,marginTop:2},heroHint:{color:c.textMuted,fontSize:10,marginTop:9},
    sectionHeading:{marginBottom:10,marginTop:2},sectionTitle:{color:c.text,fontSize:15,fontWeight:'900'},caption:{color:c.textMuted,fontSize:10,marginTop:3},form:{backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:20,padding:15,marginBottom:22},label:{color:c.text,fontSize:11,fontWeight:'800',marginTop:12,marginBottom:7},inputWrap:{minHeight:49,borderRadius:13,borderWidth:1,borderColor:c.border,backgroundColor:c.background,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},input:{flex:1,color:c.text,fontSize:13,paddingVertical:10},at:{color:c.primary,fontSize:15,fontWeight:'900'},helper:{color:c.textMuted,fontSize:9,marginTop:6},bioWrap:{minHeight:94,alignItems:'flex-start',paddingTop:12},bioInput:{minHeight:76,textAlignVertical:'top',paddingTop:0},counter:{color:c.textMuted,fontSize:9,textAlign:'right',marginTop:5},
    collection:{minHeight:82,borderRadius:18,borderWidth:1,borderColor:c.border,backgroundColor:c.surface,padding:13,flexDirection:'row',alignItems:'center',gap:11,marginBottom:17},collectionIcon:{width:46,height:46,borderRadius:14,backgroundColor:c.primary,alignItems:'center',justifyContent:'center'},collectionTitle:{color:c.text,fontSize:13,fontWeight:'900'},collectionDescription:{color:c.textMuted,fontSize:10,lineHeight:15,marginTop:3},save:{minHeight:53,borderRadius:16,backgroundColor:c.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,shadowColor:c.primary,shadowOpacity:0.22,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:4},saveText:{color:'#FFFFFF',fontSize:13,fontWeight:'900'},footer:{color:c.textMuted,fontSize:9,textAlign:'center',marginTop:18}
  });
}
