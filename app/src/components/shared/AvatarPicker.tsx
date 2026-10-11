import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import KidAvatar from './KidAvatar';
import { colors } from '@/constants/tokens';
const AVATARS = Array.from({ length: 20 }, (_, i) => ({ id: `avatar-${String(i + 1).padStart(2, '0')}` }));
export default function AvatarPicker({ selectedId, onSelect, accentColor = colors.navy900 }: { selectedId: string; onSelect: (id: string) => void; accentColor?: string }) {
 return <View style={styles.grid}>{AVATARS.map((item, i) => <TouchableOpacity key={item.id}
   accessibilityRole="button" accessibilityLabel={`Choose kid portrait ${i + 1}`} accessibilityState={{ selected: item.id === selectedId }}
   onPress={() => onSelect(item.id)} style={[styles.cell, { borderColor: item.id === selectedId ? accentColor : 'transparent' }]}>
   <KidAvatar avatarId={item.id} size={54} />
   {item.id === selectedId && <View style={[styles.check, { backgroundColor: accentColor }]}><Text style={styles.checkText}>✓</Text></View>}
 </TouchableOpacity>)}</View>;
}
export { AVATARS };
const styles = StyleSheet.create({
 grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginVertical: 12 },
 cell: { width: '22%', minHeight: 70, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
 check: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
 checkText: { color: colors.onAccent, fontWeight: '800', fontSize: 13 },
});
