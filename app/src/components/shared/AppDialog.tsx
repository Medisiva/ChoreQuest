import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useDialogStore } from '@/services/dialogs';
import { colors } from '@/constants/tokens';
export default function AppDialog() {
 const { dialog, close } = useDialogStore();
 if (!dialog) return null;
 return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={styles.backdrop}><View style={styles.card} accessibilityRole="alert">
 <Text style={styles.title}>{dialog.title}</Text>{dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
 <View style={styles.actions}>{dialog.buttons.map((button, index) => <TouchableOpacity key={index} accessibilityRole="button" style={[styles.button, button.style === 'destructive' && { backgroundColor: colors.danger }]} onPress={() => { close(); button.onPress?.(); }}><Text style={styles.buttonText}>{button.text || 'OK'}</Text></TouchableOpacity>)}</View>
 </View></View></Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', padding: 24 }, card: { width: '100%', maxWidth: 460, alignSelf: 'center', borderRadius: 24, backgroundColor: colors.surface, padding: 24 }, title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: colors.ink950 }, message: { fontSize: 16, lineHeight: 24, color: colors.ink600, marginVertical: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, button: { minHeight: 48, padding: 14, backgroundColor: colors.navy900, borderRadius: 14 }, buttonText: { color: colors.onAccent, fontWeight: '700' } });
