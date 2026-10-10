import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTaskStore } from '@/stores/taskStore';
import { useFamilyStore } from '@/stores/familyStore';
import { updateTask } from '@/services/tasks';
import type { Task } from '@/types';

export default function EditQuest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === id));
  const router = useRouter();
  if (!task) return <SafeAreaView style={styles.screen}><Text style={styles.description}>This quest is no longer available.</Text><TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>Back to quests</Text></TouchableOpacity></SafeAreaView>;
  return <QuestForm key={task.id} task={task} />;
}
function QuestForm({ task }: { task: Task }) {
  const router = useRouter(); const family = useFamilyStore((state) => state.family);
  const [title, setTitle] = useState(task.title); const [description, setDescription] = useState(task.description || '');
  const [stars, setStars] = useState(String(task.starValue)); const [saving, setSaving] = useState(false);
  const locked = Boolean(task.activeClaimId);
  const save = async () => {
    if (!family) return;
    const amount = Number(stars);
    if (!title.trim() || title.trim().length > 120 || description.length > 1000 || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000) {
      Alert.alert('Check your details', 'Enter a title and a whole star amount from 1 to 1,000.'); return;
    }
    setSaving(true);
    try {
      await updateTask(family.id, task.id, { title: title.trim(), description: description.trim(), ...(!locked && !task.isMilestone ? { starValue: amount } : {}) });
      router.back();
    } catch (error) { Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <TouchableOpacity onPress={() => router.back()} disabled={saving}><Text style={styles.link}>← Back</Text></TouchableOpacity>
    <Text style={styles.title}>Edit quest</Text>
    <Text style={styles.label}>Title</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120} editable={!saving} accessibilityLabel="Quest title" />
    <Text style={styles.label}>Description</Text><TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} maxLength={1000} multiline editable={!saving} accessibilityLabel="Quest description" />
    <Text style={styles.label}>Stars</Text><TextInput style={styles.input} value={stars} onChangeText={setStars} keyboardType="number-pad" editable={!saving && !locked && !task.isMilestone} accessibilityLabel="Quest star reward" />
    {(locked || task.isMilestone) && <Text style={styles.description}>{locked ? 'This quest is claimed. Its reward and completion requirements stay fixed.' : 'This quest uses milestone rewards. Its step rewards stay fixed.'}</Text>}
    <TouchableOpacity style={styles.button} disabled={saving} onPress={() => { void save(); }} accessibilityRole="button">{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save quest</Text>}</TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FF' }, content: { padding: 24, gap: 16 },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#1555E8' }, label: { fontSize: 16, color: '#16244D' }, description: { fontSize: 15, lineHeight: 22, color: '#555', padding: 16 },
  input: { padding: 16, borderWidth: 1, borderColor: '#DCE4ED', borderRadius: 12, fontSize: 16, backgroundColor: '#FFF' }, multiline: { minHeight: 120, textAlignVertical: 'top' },
  button: { padding: 18, alignItems: 'center', backgroundColor: '#1555E8', borderRadius: 12 }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' }, link: { fontSize: 16, color: '#1555E8', paddingVertical: 8 },
});
