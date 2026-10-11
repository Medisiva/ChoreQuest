// S3-02: Task Library Browser (P-04)
// Age + category two-axis filter. Task grid. Tap → preview bottom sheet.
// 'Post Quest' and 'Customise first' both work.
// Library data loaded ONCE and cached in component state (not Zustand).

import Alert from '@/services/dialogs';
import { saveErrorMessage } from '@/services/errorMessage';
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { createTask } from '@/services/tasks';
import { useFamilyStore } from '@/stores/familyStore';
import { useAuthStore } from '@/stores/authStore';
import type { TaskLibraryItem, Category, AgeGroup } from '@/types';

const CATEGORIES: { label: string; value: Category | 'All'; icon: string; deep: string; light: string }[] = [
  { label: 'All', value: 'All', icon: '✨', deep: '#65F3FF', light: '#17363A' },
  { label: 'Household', value: 'Household', icon: '🏠', deep: '#65F3FF', light: '#17363A' },
  { label: 'Learning', value: 'Learning', icon: '📚', deep: '#B7A1FF', light: '#302445' },
  { label: 'Life Skills', value: 'LifeSkills', icon: '🌱', deep: '#CDFF65', light: '#26351D' },
  { label: 'Hobbies', value: 'Hobbies', icon: '🎨', deep: '#FFBA82', light: '#392719' },
];

const AGE_GROUPS: { label: string; value: AgeGroup | 'All' }[] = [
  { label: 'All Ages', value: 'All' },
  { label: '3-5', value: '3-5' },
  { label: '6-8', value: '6-8' },
  { label: '9-11', value: '9-11' },
  { label: '12-14', value: '12-14' },
  { label: '15-17', value: '15-17' },
];

// Module-level cache to survive tab navigation without re-fetching
let libraryCache: TaskLibraryItem[] | null = null;

export default function TaskLibraryBrowser() {
  const router = useRouter();
  const { family } = useFamilyStore();
  const { user } = useAuthStore();
  const [items, setItems] = useState<TaskLibraryItem[]>(libraryCache ?? []);
  const [loading, setLoading] = useState(!libraryCache);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [posting, setPosting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [ageFilter, setAgeFilter] = useState<AgeGroup | 'All'>('All');
  const [selectedItem, setSelectedItem] = useState<TaskLibraryItem | null>(null);

  useEffect(() => {
    if (libraryCache) return;
    setLoading(true); setLoadError(false);
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'taskLibrary'));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskLibraryItem);
        libraryCache = data;
        setItems(data);
      } catch (err) {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const filtered = useMemo(() => {
    let result = items;
    if (categoryFilter !== 'All') result = result.filter((i) => i.category === categoryFilter);
    if (ageFilter !== 'All') result = result.filter((i) => i.ageGroupSuggestion === ageFilter);
    return result;
  }, [items, categoryFilter, ageFilter]);

  const handlePost = useCallback(async (item: TaskLibraryItem) => {
    if (!family || !user) return;
    setPosting(true);
    try {
      await createTask(family.id, {
        title: item.title,
        description: item.description,
        category: item.category,
        starValue: item.suggestedStars,
        difficulty: item.difficulty,
        ageGroupSuggestion: item.ageGroupSuggestion,
        requiresPhoto: false,
        isMilestone: item.isMilestone,
        milestoneSteps: item.milestoneSteps,
        starsPerStep: item.starsPerStep,
        milestoneBonus: item.milestoneBonus,
        recurrenceType: 'none',
        createdByParentId: user.uid,
      });
      setSelectedItem(null);
    } catch (error) {
      Alert.alert('Quest not saved', saveErrorMessage(error));
    } finally {
      setPosting(false);
    }
  }, [family, user]);

  const getCatConfig = (cat: Category) => CATEGORIES.find((c) => c.value === cat);

  const renderItem = useCallback(({ item }: { item: TaskLibraryItem }) => {
    const catConfig = getCatConfig(item.category);
    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => setSelectedItem(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.gridCardHeader, { backgroundColor: catConfig?.deep ?? '#65F3FF' }]}>
          <Text style={styles.gridCardIcon}>{catConfig?.icon}</Text>
        </View>
        <View style={styles.gridCardBody}>
          <Text style={styles.gridCardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.gridCardStars}>⭐ {item.suggestedStars}</Text>
          {item.isMilestone && <Text style={styles.gridCardMilestone}>📊 {item.milestoneSteps} steps</Text>}
        </View>
      </TouchableOpacity>
    );
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#65F3FF" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {loadError && <TouchableOpacity onPress={() => setReload(value=>value+1)}><Text style={{color:'#F7F5FF'}} accessibilityRole="alert">Could not load the library. Tap to retry.</Text></TouchableOpacity>}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Quest Library</Text>
      </View>

      {/* Age filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {AGE_GROUPS.map((a) => (
          <TouchableOpacity
            key={a.value}
            style={[styles.chip, ageFilter === a.value && styles.chipActive]}
            onPress={() => setAgeFilter(a.value as AgeGroup | 'All')}
          >
            <Text style={[styles.chipText, ageFilter === a.value && styles.chipTextActive]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.chip, categoryFilter === c.value && { backgroundColor: c.deep }]}
            onPress={() => setCategoryFilter(c.value as Category | 'All')}
          >
            <Text style={[styles.chipText, categoryFilter === c.value && styles.chipTextActive]}>
              {c.icon} {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid */}
      {filtered.length > 0 ? (
        <FlashList
          data={filtered}
          renderItem={renderItem}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No library tasks match these filters</Text>
        </View>
      )}

      {/* Preview sheet */}
      <Modal visible={!!selectedItem} animationType="slide" transparent onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            {selectedItem && (
              <>
                <View style={[styles.previewCatBadge, { backgroundColor: getCatConfig(selectedItem.category)?.light }]}>
                  <Text style={[styles.previewCatText, { color: getCatConfig(selectedItem.category)?.deep }]}>
                    {getCatConfig(selectedItem.category)?.icon} {selectedItem.category}
                  </Text>
                </View>
                <Text style={styles.previewTitle}>{selectedItem.title}</Text>
                <Text style={styles.previewDesc}>{selectedItem.description}</Text>
                <Text style={styles.previewStars}>⭐ {selectedItem.suggestedStars} stars</Text>
                <View style={styles.previewMeta}>
                  <Text style={styles.previewMetaText}>{selectedItem.difficulty}</Text>
                  <Text style={styles.previewMetaText}>Ages {selectedItem.ageGroupSuggestion}</Text>
                  {selectedItem.isMilestone && <Text style={styles.previewMetaText}>📊 {selectedItem.milestoneSteps} steps</Text>}
                </View>
                <TouchableOpacity
                  style={styles.postButton}
                  onPress={() => handlePost(selectedItem)}
                  disabled={posting}
                >
                  {posting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.postButtonText}>Post this Quest</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.customizeButton}
                  onPress={() => { setSelectedItem(null); router.push({ pathname: '/(parent)/tasks/create', params: { libraryId: selectedItem.id } } as never); }}
                >
                  <Text style={styles.customizeText}>Customise first</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedItem(null)}>
                  <Text style={styles.closeText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#23232F' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#65F3FF', marginBottom: 8 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#F7F5FF' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#121219', marginRight: 8, borderWidth: 1, borderColor: '#17363A' },
  chipActive: { backgroundColor: '#65F3FF', borderColor: '#65F3FF' },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  chipTextActive: { color: '#17200C' },
  gridContent: { paddingHorizontal: 12, paddingBottom: 100 },
  gridCard: { flex: 1, margin: 4, backgroundColor: '#121219', borderRadius: 12, overflow: 'hidden', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1 },
  gridCardHeader: { height: 40, justifyContent: 'center', alignItems: 'center' },
  gridCardIcon: {color:'#F7F5FF', fontSize: 20 },
  gridCardBody: { padding: 10 },
  gridCardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#F7F5FF', marginBottom: 6 },
  gridCardStars: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#F7F5FF' },
  gridCardMilestone: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#B7A1FF', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#C0BDCF' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#121219', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#17363A', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  previewCatBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  previewCatText: {color:'#F7F5FF', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  previewTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#F7F5FF', marginBottom: 8 },
  previewDesc: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#C0BDCF', lineHeight: 22, marginBottom: 12 },
  previewStars: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#F7F5FF', marginBottom: 12 },
  previewMeta: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  previewMetaText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#C0BDCF', backgroundColor: '#23232F', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  postButton: { backgroundColor: '#65F3FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  postButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#17200C' },
  customizeButton: { borderWidth: 1, borderColor: '#65F3FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  customizeText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#65F3FF' },
  closeButton: { alignItems: 'center', paddingVertical: 12 },
  closeText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#A9A7BA' },
});
