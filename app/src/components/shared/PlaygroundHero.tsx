import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/tokens';
import KidAvatar from './KidAvatar';

export default function PlaygroundHero({ title, subtitle, avatarId = 'avatar-06', compact = false }: { title: string; subtitle: string; avatarId?: string; compact?: boolean }) {
  return <View style={[styles.hero, compact && { padding: 18, minHeight: 122 }]}>
    <View style={styles.copy}><Text style={styles.eyebrow}>CHOREQUEST · LITTLE WINS</Text>
      <Text style={[styles.title, compact && { fontSize: 24, lineHeight: 29 }]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text></View>
    <View style={styles.portrait}><KidAvatar avatarId={avatarId} size={compact ? 76 : 104} /><Text style={styles.star}>★</Text></View>
  </View>;
}
const styles = StyleSheet.create({
 hero: { backgroundColor: colors.navy900, borderRadius: 28, padding: 22, minHeight: 166, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
 copy: { flex: 1 }, eyebrow: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: '#FFF5B0', letterSpacing: 1, marginBottom: 9 },
 title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 30, lineHeight: 35, color: colors.white },
 subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.white, marginTop: 8 },
 portrait: { padding: 4, borderRadius: 80, backgroundColor: colors.starGold },
 star: { position: 'absolute', bottom: -8, right: 0, fontSize: 30, color: colors.starGold },
});
