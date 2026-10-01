import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { unlockParentMode, signOut } from '@/services/auth';

export default function ParentUnlock() {
  const router = useRouter(); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  const unlock = async () => {
    if (!password || loading) return; setLoading(true);
    try { await unlockParentMode(password); setPassword(''); router.replace('/(parent)/dashboard'); }
    catch (error) { Alert.alert('Could not unlock', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setLoading(false); }
  };
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
    <TouchableOpacity onPress={() => router.replace('/profiles')}><Text style={styles.link}>← Profiles</Text></TouchableOpacity>
    <Text style={styles.title}>Parent access</Text>
    <Text style={styles.description}>Enter your parent account password to manage the family.</Text>
    <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" autoCapitalize="none" autoCorrect={false} textContentType="password" accessibilityLabel="Parent account password" editable={!loading} onSubmitEditing={() => { void unlock(); }} />
    <TouchableOpacity style={styles.button} onPress={() => { void unlock(); }} disabled={loading || !password} accessibilityRole="button">
      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Unlock parent mode</Text>}
    </TouchableOpacity>
    <TouchableOpacity disabled={loading} onPress={async () => { await signOut(); router.replace('/(auth)/login'); }}><Text style={styles.link}>Sign in with another account</Text></TouchableOpacity>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 24, gap: 20 },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#1A3E6E' }, description: { fontSize: 16, lineHeight: 24, color: '#555' },
  input: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#DCE4ED', backgroundColor: '#FFF', fontSize: 16 },
  button: { padding: 18, alignItems: 'center', backgroundColor: '#1A3E6E', borderRadius: 12 }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' }, link: { color: '#1A3E6E', fontSize: 16, paddingVertical: 8 },
});
