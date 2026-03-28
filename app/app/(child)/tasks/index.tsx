// S2-07: Task Feed screen (C-02)
// FlashList with category filter chips. Claimed-by-sibling cards greyed with lock.
// Active claim banner pinned at top.

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../../../src/stores/taskStore';
import { useChildSessionStore } from '../../../src/stores/childSessionStore';
import type { Task, TaskClaim, Category } from '../../../src/types';

const CATEGORIES: { label: string; value: Category | 'All'; icon: string; deep: string; light: string }[] = [
  { label: 'All', value: 'All', icon: '✨', deep: '#1A3E6E', light: '#E8F2FB' },
  { label: 'Household', value: 'Household', icon: '🏠', deep: '#1B6CA8', light: '#DBEAFE' },
  { label: 'Learning', value: 'Learning', icon: '📚', deep: '#7B2D8B', light: '#EDE9FE' },
  { label: 'Life Skills', value: 'LifeSkills', icon: '🌱', deep: '#0D7377', light: '#CCFBF1' },
  { label: 'Hobbies', value: 'Hobbies', icon: '🎨', deep: '#B85C00', light: '#FFEDD5' },
];

export default function TaskFeedScreen() {
  const router = useRouter();
  const { tasks, claims } = useTaskStore();
  const { activeChildId } = useChildSessionStore();
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  const filteredTasks = useMemo(() => {
    if (selectedCategory === 'All') return tasks;
    return tasks.filter((t) => t.category === selectedCategory);
  }, [tasks, selectedCategory]);

  const activeClaim = useMemo(
    () => claims.find((c) => c.childProfileId === activeChildId && (c.status === 'claimed' || c.status === 'submitted')),
    [claims, activeChildId]
  );

  const getClaimForTask = useCallback(
    (taskId: string): TaskClaim | undefined =>
      claims.find((c) => c.taskId === taskId && (c.status === 'claimed' || c.status === 'submitted')),
    [claims]
  );

  const renderTaskCard = useCallback(
    ({ item }: { item: Task }) => {
      const claim = getClaimForTask(item.id);
      const isClaimedBySibling = claim && claim.childProfileId !== activeChildId;
      const isClaimedByMe = claim && claim.childProfileId === activeChildId;
      const catInfo = CATEGORIES.find((c) => c.value === item.category);

      return (
        <TouchableOpacity
          style={[styles.taskCard, isClaimedBySibling && styles.taskCardClaimed]}
          onPress={() => router.push(`/(child)/tasks/${item.id}` as never)}
          activeOpacity={0.7}
          disabled={!!isClaimedBySibling}
        >
          <View style={[styles.categoryBorder, { backgroundColor: catInfo?.deep ?? '#1A3E6E' }]} />
          <View style={styles.taskContent}>
            <View style={styles.taskHeader}>
              <Text style={styles.categoryIcon}>{catInfo?.icon}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: catInfo?.light ?? '#E8F2FB' }]}>
                <Text style={[styles.categoryBadgeText, { color: catInfo?.deep }]}>{item.category}</Text>
              </View>
              {item.isMilestone && (
                <View style={styles.milestoneBadge}>
                  <Text style={styles.milestoneBadgeText}>📊 Multi-step</Text>
                </View>
              )}
            </View>
            <Text style={[styles.taskTitle, isClaimedBySibling && styles.taskTitleClaimed]}>{item.title}</Text>
            {item.description && <Text style={styles.taskDescription} numberOfLines={1}>{item.description}</Text>}
            <View style={styles.taskFooter}>
              <Text style={styles.starValue}>⭐ {item.starValue}</Text>
              <View style={[styles.difficultyBadge, getDifficultyBg(item.difficulty)]}>
                <Text style={styles.difficultyText}>{item.difficulty}</Text>
              </View>
            </View>
            {isClaimedBySibling && <Text style={styles.lockedText}>🔒 Someone is on it</Text>}
            {isClaimedByMe && (
              <Text style={styles.myClaimText}>
                {claim?.status === 'submitted' ? '⏳ Waiting for review' : '✋ You claimed this'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [getClaimForTask, activeChildId, router]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Quests</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.filterChip, selectedCategory === cat.value && { backgroundColor: cat.deep }]}
            onPress={() => setSelectedCategory(cat.value as Category | 'All')}
          >
            <Text style={[styles.filterChipText, selectedCategory === cat.value && styles.filterChipTextActive]}>
              {cat.icon} {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeClaim && (
        <TouchableOpacity style={styles.claimBanner} onPress={() => router.push(`/(child)/tasks/${activeClaim.taskId}` as never)}>
          <Text style={styles.claimBannerText}>You&apos;re working on a quest. Tap to continue →</Text>
        </TouchableOpacity>
      )}

      {filteredTasks.length > 0 ? (
        <FlashList
          data={filteredTasks}
          renderItem={renderTaskCard}
          estimatedItemSize={90}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>
            {selectedCategory === 'All'
              ? "No quests yet! Your parent hasn't posted any quests."
              : `No ${selectedCategory} quests right now — check back soon!`}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function getDifficultyBg(d: string) {
  switch (d) {
    case 'Easy': return { backgroundColor: '#D1FAE5' };
    case 'Medium': return { backgroundColor: '#FEF3C7' };
    case 'Hard': return { backgroundColor: '#FEE2E2' };
    default: return { backgroundColor: '#EDE9FE' };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: '#1A1A2E' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F9FF', marginRight: 8 },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#555555' },
  filterChipTextActive: { color: '#FFFFFF' },
  claimBanner: { backgroundColor: '#FEF3C7', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12 },
  claimBannerText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#92400E' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  taskCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1, overflow: 'hidden' },
  taskCardClaimed: { opacity: 0.5 },
  categoryBorder: { width: 4, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  taskContent: { flex: 1, padding: 14 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  categoryIcon: { fontSize: 16 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  milestoneBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#EDE9FE' },
  milestoneBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#7B2D8B' },
  taskTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#1A1A2E', marginBottom: 4 },
  taskTitleClaimed: { color: '#9CA3AF' },
  taskDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#555555', marginBottom: 8 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starValue: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#1A1A2E' },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  difficultyText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#1A1A2E' },
  lockedText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  myClaimText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#B45309', marginTop: 6 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#555555', textAlign: 'center', lineHeight: 24 },
});
