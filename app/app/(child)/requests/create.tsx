// S7-02: Request for Parent Wizard (C-06)
// 3-step wizard. Category → Title & Description → Star Value.
// Weekly limit enforcement. Request library chip shortcuts.

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createRequest, getWeeklyRequestCount } from '../../../src/services/requests';
import { useFamilyStore } from '../../../src/stores/familyStore';
import { useChildSessionStore } from '../../../src/stores/childSessionStore';
import type { Category } from '../../../src/types';

const CATEGORIES: { value: Category; icon: string; label: string; deep: string; light: string }[] = [
  { value: 'Household', icon: '🏠', label: 'Household', deep: '#1B6CA8', light: '#DBEAFE' },
  { value: 'Learning', icon: '📚', label: 'Learning', deep: '#7B2D8B', light: '#EDE9FE' },
  { value: 'LifeSkills', icon: '🌱', label: 'Life Skills', deep: '#0D7377', light: '#CCFBF1' },
  { value: 'Hobbies', icon: '🎨', label: 'Hobbies & Fun', deep: '#B85C00', light: '#FFEDD5' },
];

const SUGGESTED_REQUESTS = [
  'Take me to the park', 'Cook my favourite meal', 'Read me a story',
  'Play board games with me', 'Help me with my project', "Let's go to the library",
  'Teach me to ride my bike', 'Movie night of my choice', 'Bake cookies together',
  'Go for a walk with me', 'Help me build something', 'Take me swimming',
];

export default function RequestWizard() {
  const router = useRouter();
  const { family } = useFamilyStore();
  const { activeChildId } = useChildSessionStore();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [starValue, setStarValue] = useState(10);
  const [loading, setLoading] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [weeklyLimit, setWeeklyLimit] = useState(3);

  useEffect(() => {
    if (!family || !activeChildId) return;
    getWeeklyRequestCount(family.id, activeChildId).then(setWeeklyCount);
  }, [family, activeChildId]);

  const remainingRequests = weeklyLimit - weeklyCount;

  const handleSend = useCallback(async () => {
    if (!family || !activeChildId || !category || !title.trim()) return;
    if (remainingRequests <= 0) {
      Alert.alert('Limit reached', "You've used all your requests this week.");
      return;
    }

    setLoading(true);
    try {
      await createRequest(family.id, {
        familyAccountId: family.id,
        requestedByChildId: activeChildId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        suggestedStars: starValue,
      });
      Alert.alert('Request sent!', 'Your parent will let you know.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not send request. Try again.');
    } finally {
      setLoading(false);
    }
  }, [family, activeChildId, category, title, description, starValue, remainingRequests, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (step > 1 ? setStep(step - 1) : router.back())}>
            <Text style={styles.backText}>← {step > 1 ? 'Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          <Text style={styles.limitText}>
            {remainingRequests > 0
              ? `${remainingRequests} request${remainingRequests !== 1 ? 's' : ''} left this week`
              : 'No requests left this week'}
          </Text>
        </View>

        {/* Step dots */}
        <View style={styles.dots}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.dot, s <= step && styles.dotActive]} />
          ))}
        </View>

        {/* Step 1: Category */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>What kind of thing are you asking for?</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryTile,
                    { backgroundColor: category === cat.value ? cat.deep : cat.light },
                  ]}
                  onPress={() => { setCategory(cat.value); setStep(2); }}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryLabel, { color: category === cat.value ? '#FFF' : cat.deep }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Title & Description */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>What do you want?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Take me to the park"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              maxLength={60}
            />
            <Text style={styles.charCount}>{title.length}/60</Text>

            <Text style={styles.label}>Tell your parent more (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="e.g. I really want to go because it's sunny!"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              maxLength={100}
              multiline
            />

            <Text style={styles.label}>Need ideas?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsRow}>
              {SUGGESTED_REQUESTS.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setTitle(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.nextButton, !title.trim() && styles.nextDisabled]}
              onPress={() => title.trim() && setStep(3)}
              disabled={!title.trim()}
            >
              <Text style={styles.nextText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Star Value */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>How many stars do you think this is worth?</Text>

            <View style={styles.starPicker}>
              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => setStarValue(Math.max(1, starValue - 5))}
              >
                <Text style={styles.starBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.starDisplay}>⭐ {starValue}</Text>
              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => setStarValue(Math.min(100, starValue + 5))}
              >
                <Text style={styles.starBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>
              Your parent can change this — it&apos;s just your suggestion!
            </Text>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.sendText}>Send Request</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footnote}>
              Your parent will see this and decide if they want to do it.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF0F6' },
  content: { padding: 24, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#FF6B6B' },
  limitText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#555555' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8F2FB' },
  dotActive: { backgroundColor: '#FF6B6B', width: 24 },
  stepTitle: { fontFamily: 'Nunito_700Bold', fontSize: 24, color: '#1A1A2E', marginBottom: 20, textAlign: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  categoryTile: { width: '45%', paddingVertical: 28, borderRadius: 16, alignItems: 'center', gap: 8 },
  categoryIcon: { fontSize: 32 },
  categoryLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8F2FB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#1A1A2E' },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  charCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#1A1A2E', marginTop: 16, marginBottom: 8 },
  suggestionsRow: { marginBottom: 24 },
  suggestionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', marginRight: 8, borderWidth: 1, borderColor: '#FFF0F6' },
  suggestionText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#555555' },
  nextButton: { backgroundColor: '#FF6B6B', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  nextDisabled: { opacity: 0.4 },
  nextText: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#FFFFFF' },
  starPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 32 },
  starBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, shadowOpacity: 0.1, shadowColor: '#000' },
  starBtnText: { fontSize: 28, color: '#1A1A2E', fontWeight: '700' },
  starDisplay: { fontFamily: 'Nunito_800ExtraBold', fontSize: 48, color: '#1A1A2E' },
  helperText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#555555', textAlign: 'center', marginBottom: 32 },
  sendButton: { backgroundColor: '#FF6B6B', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  sendText: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#FFFFFF' },
  footnote: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 16 },
});
