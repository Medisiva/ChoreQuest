// S2-06: Task Pool Manager (P-02)
// FlashList task list, category filter chips, swipe-to-delete, FAB to create.

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../../../src/stores/taskStore';
import { useFamilyStore } from '../../../src/stores/familyStore';
import { deleteTask } from '../../../src/services/tasks';
import type { Task, Category } from '../../../src/types';

const FILTERS: { label: string; value: Category | 'All'; icon: string }[] = [
  { label: 'All', value: 'All', icon: '✨' },
  { label: 'Household', value: 'Household', icon: '🏠' },
  { label: 'Learning', value: 'Learning', icon: '📚' },
  { label: 'Life Skills', value: 'LifeSkills', icon: '🌱' },
  { label: 'Hobbies', value: 'Hobbies', icon: '🎨' },
];

const CATEGORY_DEEP: Record<string, string> = {
  Household: '#1B6CA8', Learning: '#7B2D8B', LifeSkills: '#0D7377', Hobbies: '#B85C00',
};

export default function TaskPoolManager() {
  const router = useRouter();
  const { tasks, claims } = useTaskStore();
  const { family } = useFamilyStore();
  const [filter, setFilter] = useState<Category | 'All'>('All');

  const filteredTasks = useMemo(() => {
    if (filter === 'All') return tasks;
    return tasks.filter((t) => t.category === filter);
  }, [tasks, filter]);

  const getClaimStatus = useCallback(
    (taskId: string): string => {
      const claim = claims.find((c) => c.taskId === taskId && (c.status === 'claimed' || c.status === 'submitted'));
      if (!claim) return 'Unclaimed';
      return claim.status === 'submitted' ? 'Pending approval' : 'Claimed';
    },
    [claims]
  );

  const handleDelete = useCallback(
    (task: Task) => {
      if (!family) return;
      Alert.alert('Delete Quest', `Remove "${task.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTask(family.id, task.id),
        },
      ]);
    },
    [family]
  );

  const renderTask = useCallback(
    ({ item }: { item: Task }) => {
      const status = getClaimStatus(item.id);
      const deepColor = CATEGORY_DEEP[item.category] ?? '#1A3E6E';

      return (
        <TouchableOpacity
          style={styles.taskCard}
          onPress={() => console.log('Edit task', item.id)}
          onLongPress={() => handleDelete(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.catBorder, { backgroundColor: deepColor }]} />
          <View style={styles.taskBody}>
            <View style={styles.taskRow}>
              <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
              {item.isMilestone && <Text style={styles.milestoneTag}>📊</Text>}
              {item.recurrenceType !== 'none' && <Text style={styles.recurrenceTag}>🔄</Text>}
            </View>
            <View style={styles.taskMeta}>
              <Text style={styles.starValue}>⭐ {item.starValue}</Text>
              <Text style={[styles.statusChip, status === 'Unclaimed' ? styles.statusOpen : styles.statusActive]}>
                {status}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [getClaimStatus, handleDelete]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Quests</Text>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value as Category | 'All')}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.icon} {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task Library link */}
      {tasks.length < 5 && (
        <TouchableOpacity style={styles.libraryLink} onPress={() => router.push('/(parent)/tasks/library' as never)}>
          <Text style={styles.libraryLinkText}>📚 Browse task library</Text>
        </TouchableOpacity>
      )}

      {/* Task list */}
      {filteredTasks.length > 0 ? (
        <FlashList
          data={filteredTasks}
          renderItem={renderTask}
          estimatedItemSize={80}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>
            {filter === 'All'
              ? 'No quests yet — tap + to create one!'
              : `No ${filter} quests — add one from the library`}
          </Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(parent)/tasks/create')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#1A1A2E' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', marginRight: 8, borderWidth: 1, borderColor: '#E8F2FB' },
  filterChipActive: { backgroundColor: '#1A3E6E', borderColor: '#1A3E6E' },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#555555' },
  filterTextActive: { color: '#FFFFFF' },
  libraryLink: { marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: '#E8F2FB', borderRadius: 12, alignItems: 'center' },
  libraryLinkText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#2E6DB4' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  taskCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 8, overflow: 'hidden', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1 },
  catBorder: { width: 4 },
  taskBody: { flex: 1, padding: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  taskTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#1A1A2E', flex: 1 },
  milestoneTag: { fontSize: 14 },
  recurrenceTag: { fontSize: 14 },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starValue: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#1A1A2E' },
  statusChip: { fontFamily: 'Inter_500Medium', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusOpen: { backgroundColor: '#D1FAE5', color: '#1B7A34' },
  statusActive: { backgroundColor: '#FEF3C7', color: '#B45309' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', textAlign: 'center' },
  fab: { position: 'absolute', bottom: 96, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A3E6E', justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.15, shadowColor: 'rgba(26,62,110,0.12)', elevation: 3 },
  fabText: { fontSize: 28, color: '#FFFFFF', fontWeight: '600', marginTop: -2 },
});
