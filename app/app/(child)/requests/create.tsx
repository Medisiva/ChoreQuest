import { doc, collection } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { errorMessage } from '@/services/errorMessage';
// S7-02: Request for Parent Wizard (C-06)
// 3-step wizard. Category → Title & Description → Star Value.
// Weekly limit enforcement. Request library chip shortcuts.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Alert from '@/services/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createRequest, getWeeklyRequestAllowance } from '@/services/requests';
import { useFamilyStore } from '@/stores/familyStore';
import { useChildSessionStore } from '@/stores/childSessionStore';
import type { Category } from '@/types';

const CATEGORIES: { value: Category; icon: string; label: string; deep: string; light: string }[] = [
  { value: 'Household', icon: '🏠', label: 'Household', deep: '#65F3FF', light: '#17363A' },
  { value: 'Learning', icon: '📚', label: 'Learning', deep: '#B7A1FF', light: '#302445' },
  { value: 'LifeSkills', icon: '🌱', label: 'Life Skills', deep: '#CDFF65', light: '#26351D' },
  { value: 'Hobbies', icon: '🎨', label: 'Hobbies & Fun', deep: '#FFBA82', light: '#392719' },
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

  const sending = useRef(false);
  const intentId = useRef(doc(collection(db,'operationIds')).id);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [starValue, setStarValue] = useState(10);
  const [loading, setLoading] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [weeklyLimit,setWeeklyLimit] = useState(3);

  useEffect(() => {
    if (!family || !activeChildId) return;
    getWeeklyRequestAllowance(family.id, activeChildId).then(({count,limit})=>{setWeeklyCount(count);setWeeklyLimit(limit);}).catch(error => Alert.alert('Could not load request limit',errorMessage(error)));
  }, [family, activeChildId]);

  const remainingRequests = weeklyLimit - weeklyCount;

  const handleSend = useCallback(async () => {
    if (!family || !activeChildId || !category || !title.trim()) return;
    if (remainingRequests <= 0) {
      Alert.alert('Limit reached', "You've used all your requests this week.");
      return;
    }

    if(sending.current)return;
    sending.current=true;
    setLoading(true);
    try {
      await createRequest(family.id, {
        familyAccountId: family.id,
        requestedByChildId: activeChildId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        suggestedStars: starValue,
        operationId: intentId.current,
      });
      router.replace('/(child)/requests');
      Alert.alert('Request sent!', 'Your parent will let you know.');
    } catch(error) {
      sending.current=false;
      Alert.alert('Could not send request',errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [family, activeChildId, category, title, description, starValue, remainingRequests, router]);

  return (
    <SafeAreaView style={styles.container}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
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
                  <Text style={[styles.categoryLabel, { color: category === cat.value ? '#17200C' : cat.deep }]}>
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
              placeholderTextColor="#A9A7BA"
              value={title}
              onChangeText={setTitle}
              maxLength={60}
            />
            <Text style={styles.charCount}>{title.length}/60</Text>

            <Text style={styles.label}>Tell your parent more (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="e.g. I really want to go because it's sunny!"
              placeholderTextColor="#A9A7BA"
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
                onPress={() => setStarValue(Math.max(1, starValue - 1))}
              >
                <Text style={styles.starBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.starDisplay}>⭐ {starValue}</Text>
              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => setStarValue(Math.min(100, starValue + 1))}
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
      </ScrollView></KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#341C2D' },
  content: { padding: 24, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#FF76C5' },
  limitText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#17363A' },
  dotActive: { backgroundColor: '#FF76C5', width: 24 },
  stepTitle: { fontFamily: 'Nunito_700Bold', fontSize: 24, color: '#F7F5FF', marginBottom: 20, textAlign: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  categoryTile: { width: '45%', paddingVertical: 28, borderRadius: 16, alignItems: 'center', gap: 8 },
  categoryIcon: {color:'#F7F5FF', fontSize: 32 },
  categoryLabel: {color:'#F7F5FF', fontFamily: 'Nunito_700Bold', fontSize: 15 },
  input: { backgroundColor: '#121219', borderWidth: 1, borderColor: '#17363A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#F7F5FF' },
  inputMultiline: {color:'#F7F5FF', height: 80, textAlignVertical: 'top' },
  charCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#A9A7BA', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#F7F5FF', marginTop: 16, marginBottom: 8 },
  suggestionsRow: { marginBottom: 24 },
  suggestionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#121219', marginRight: 8, borderWidth: 1, borderColor: '#341C2D' },
  suggestionText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#C0BDCF' },
  nextButton: { backgroundColor: '#FF76C5', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  nextDisabled: { opacity: 0.4 },
  nextText: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#17200C' },
  starPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 32 },
  starBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#121219', justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, shadowOpacity: 0.1, shadowColor: '#000' },
  starBtnText: { fontSize: 28, color: '#F7F5FF', fontWeight: '700' },
  starDisplay: { fontFamily: 'Nunito_800ExtraBold', fontSize: 48, color: '#F7F5FF' },
  helperText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#C0BDCF', textAlign: 'center', marginBottom: 32 },
  sendButton: { backgroundColor: '#FF76C5', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  sendText: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#17200C' },
  footnote: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#A9A7BA', textAlign: 'center', marginTop: 16 },
});
