import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '@/services/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { resetChildPin } from '@/services/families';
import { useFamilyStore } from '@/stores/familyStore';

export default function ResetPinScreen() {
  const router = useRouter();
  const { family, children } = useFamilyStore();
  const [childId, setChildId] = useState('');
  const [pin, setPin] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!family || !childId || !/^\d{4}$/.test(pin) || pin !== confirmation) {
      Alert.alert('Check your details', 'Choose a child and enter the same four-digit PIN twice.'); return;
    }
    setSaving(true);
    try {
      await resetChildPin(family.id, childId, pin);
      setPin(''); setConfirmation('');
      Alert.alert('PIN updated', 'Your child can use their new PIN now.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch { Alert.alert('Could not reset PIN', 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back"><Text style={styles.link}>← Back</Text></TouchableOpacity>
    <Text style={styles.title}>Reset a child’s PIN</Text>
    <Text style={styles.description}>Choose a profile to unlock it and set a new PIN.</Text>
    {children.length === 0 && <Text style={styles.description}>Add a child profile first.</Text>}
    {children.map((child) => <TouchableOpacity key={child.id} style={[styles.choice, childId === child.id && styles.selected]} disabled={saving} onPress={() => { setChildId(child.id); setPin(''); setConfirmation(''); }} accessibilityRole="radio" accessibilityState={{ selected: childId === child.id }}>
      <Text style={styles.label}>{child.nickname}{childId === child.id ? ' ✓' : ''}</Text>
    </TouchableOpacity>)}
    <Text style={styles.label}>New PIN</Text>
    <TextInput placeholderTextColor="#A9A7BA" style={styles.input} value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={4} editable={!saving} accessibilityLabel="New four digit PIN" />
    <Text style={styles.label}>Confirm PIN</Text>
    <TextInput placeholderTextColor="#A9A7BA" style={styles.input} value={confirmation} onChangeText={(value) => setConfirmation(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={4} editable={!saving} accessibilityLabel="Confirm four digit PIN" />
    <TouchableOpacity style={styles.button} onPress={save} disabled={saving || !childId} accessibilityRole="button">
      {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Update PIN</Text>}
    </TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#23232F' }, content: { padding: 24, gap: 16 },
  link: { color: '#65F3FF', fontSize: 16, paddingVertical: 8 }, title: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#65F3FF' },
  description: { fontSize: 16, color: '#555', lineHeight: 24 }, label: { fontSize: 16, color: '#F7F5FF' },
  choice: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333240', backgroundColor:'#121219' }, selected: { borderColor: '#65F3FF', backgroundColor: '#17363A' },
  input: {color:'#F7F5FF', padding: 16, borderWidth: 1, borderColor: '#333240', borderRadius: 12, backgroundColor:'#121219', fontSize: 22 },
  button: { backgroundColor: '#65F3FF', padding: 18, borderRadius: 12, alignItems: 'center' }, buttonText: { color: '#17200C', fontSize: 16, fontWeight: '600' },
});
