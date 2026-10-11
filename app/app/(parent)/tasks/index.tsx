import { questRewardLabel } from '@/services/questPresentation';
// S2-06: Task Pool Manager (P-02)
// FlashList task list, category filter chips, swipe-to-delete, FAB to create.

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  } from 'react-native';
import Alert from '@/services/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useTaskStore } from '@/stores/taskStore';
import { useFamilyStore } from '@/stores/familyStore';
import { deleteTask } from '@/services/tasks';
import type { Task, Category } from '@/types';

const FILTERS: { label: string; value: Category | 'All'; icon: string }[] = [
  { label: 'All', value: 'All', icon: '✨' },
  { label: 'Household', value: 'Household', icon: '🏠' },
  { label: 'Learning', value: 'Learning', icon: '📚' },
  { label: 'Life Skills', value: 'LifeSkills', icon: '🌱' },
  { label: 'Hobbies', value: 'Hobbies', icon: '🎨' },
];

const CATEGORY_DEEP: Record<string, string> = {
  Household: '#65F3FF', Learning: '#B7A1FF', LifeSkills: '#CDFF65', Hobbies: '#FFBA82',
};

export default function TaskPoolManager() {
  const router = useRouter();
  const { tasks, claims } = useTaskStore();
  const { family } = useFamilyStore();
  const [filter, setFilter] = useState<Category | 'All'>('All');

  const filteredTasks = useMemo(() => {
    const visible = tasks.filter(task=>!task.templateOnly || claims.some(claim=>claim.taskId===task.id && ['claimed','submitted','rejected'].includes(claim.status)));
    if (filter === 'All') return visible;
    return visible.filter(t=>t.category===filter);
  }, [tasks, claims, filter]);

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
      const deepColor = CATEGORY_DEEP[item.category] ?? '#65F3FF';

      return (
        <TouchableOpacity
          style={styles.taskCard}
          onPress={() => router.push({ pathname: '/(parent)/tasks/edit', params: { id: item.id } } as never)}
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
              <Text style={styles.starValue}>⭐ {questRewardLabel(item)}</Text>
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
  container: { flex: 1, backgroundColor: '#23232F' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#F7F5FF' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#121219', marginRight: 8, borderWidth: 1, borderColor: '#17363A' },
  filterChipActive: { backgroundColor: '#65F3FF', borderColor: '#65F3FF' },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  filterTextActive: { color: '#17200C' },
  libraryLink: { marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: '#17363A', borderRadius: 12, alignItems: 'center' },
  libraryLinkText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#65F3FF' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  taskCard: { flexDirection: 'row', backgroundColor: '#121219', borderRadius: 12, marginBottom: 8, overflow: 'hidden', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1 },
  catBorder: { width: 4 },
  taskBody: { flex: 1, padding: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  taskTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#F7F5FF', flex: 1 },
  milestoneTag: {color:'#F7F5FF', fontSize: 14 },
  recurrenceTag: {color:'#F7F5FF', fontSize: 14 },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starValue: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#F7F5FF' },
  statusChip: {color:'#F7F5FF', fontFamily: 'Inter_500Medium', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusOpen: { backgroundColor: '#26351D', color: '#CDFF65' },
  statusActive: { backgroundColor: '#302719', color: '#FFE177' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: {color:'#F7F5FF', fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#C0BDCF', textAlign: 'center' },
  fab: { position: 'absolute', bottom: 96, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: '#65F3FF', justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.15, shadowColor: 'rgba(26,62,110,0.12)', elevation: 3 },
  fabText: { fontSize: 28, color: '#17200C', fontWeight: '600', marginTop: -2 },
});
