import GameArt from '@/components/shared/GameArt';
import { questRewardLabel } from '@/services/questPresentation';
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
import { useTaskStore } from '@/stores/taskStore';
import { useChildSessionStore } from '@/stores/childSessionStore';
import type { Task, TaskClaim, Category } from '@/types';

const CATEGORIES: { label: string; value: Category | 'All'; icon: string; deep: string; light: string }[] = [
  { label: 'All', value: 'All', icon: '✨', deep: '#65F3FF', light: '#17363A' },
  { label: 'Household', value: 'Household', icon: '🏠', deep: '#65F3FF', light: '#17363A' },
  { label: 'Learning', value: 'Learning', icon: '📚', deep: '#B7A1FF', light: '#302445' },
  { label: 'Life Skills', value: 'LifeSkills', icon: '🌱', deep: '#CDFF65', light: '#26351D' },
  { label: 'Hobbies', value: 'Hobbies', icon: '🎨', deep: '#FFBA82', light: '#392719' },
];

export default function TaskFeedScreen() {
  const router = useRouter();
  const { tasks, claims } = useTaskStore();
  const { activeChildId } = useChildSessionStore();
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  const filteredTasks = useMemo(() => {
    // Completed recurring templates keep their lock and are replaced by fresh instances.
    const available = tasks.filter(task => !task.templateOnly || claims.some(claim=>claim.taskId===task.id && claim.childProfileId===activeChildId && ['claimed','submitted','rejected'].includes(claim.status)));
    return selectedCategory === 'All' ? available : available.filter((task) => task.category === selectedCategory);
  }, [tasks, claims, selectedCategory, activeChildId]);

  const activeClaim = useMemo(
    () => claims.find((c) => c.childProfileId === activeChildId && (c.status === 'claimed' || c.status === 'submitted' || c.status === 'rejected')),
    [claims, activeChildId]
  );

  const getClaimForTask = useCallback(
    (taskId: string): TaskClaim | undefined =>
      claims.find((c) => c.taskId === taskId && (c.status === 'claimed' || c.status === 'submitted' || c.status === 'rejected')),
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
          <View style={[styles.categoryBorder, { backgroundColor: catInfo?.deep ?? '#65F3FF' }]} />
          <View style={styles.taskContent}><View style={styles.artRow}><GameArt kind={item.category==='Learning'?'book':item.category==='LifeSkills'?'plant':item.category==='Hobbies'?'paint':'toys'} size={80}/></View>
            <View style={styles.taskHeader}>
              <Text style={styles.categoryIcon}>{catInfo?.icon}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: catInfo?.light ?? '#17363A' }]}>
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
              {item.deadline && <Text style={{color:'#C0BDCF'}}>Due {item.deadline.toDate().toLocaleDateString()}{item.deadline.toMillis() < Date.now() ? " · Expired" : ""}</Text>}
              <Text style={styles.starValue}>⭐ {questRewardLabel(item)}</Text>
              <View style={[styles.difficultyBadge, getDifficultyBg(item.difficulty)]}>
                <Text style={styles.difficultyText}>{item.difficulty}</Text>
              </View>
            </View>
            {isClaimedBySibling && <Text style={styles.lockedText}>🔒 Someone is on it</Text>}
            {isClaimedByMe && (
              <Text style={styles.myClaimText}>
                {claim?.status === 'submitted' ? '⏳ Waiting for review' : claim?.status === 'rejected' ? '↻ Check feedback and try again' : '✋ You claimed this'}
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
        <Text style={styles.eyebrow}>A LITTLE HELP. A BIG WIN.</Text><Text style={styles.heading}>Choose your next quest.</Text><Text style={styles.subtitle}>Every adventure begins with a little “I can!”</Text>
      </View>

      <ScrollView horizontal style={{flexGrow:0,maxHeight:64}} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
    case 'Easy': return { backgroundColor: '#26351D' };
    case 'Medium': return { backgroundColor: '#302719' };
    case 'Hard': return { backgroundColor: '#391D2B' };
    default: return { backgroundColor: '#302445' };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121219' },
  eyebrow: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11, letterSpacing: 1, color: '#A9A7BA', marginBottom: 9 },
  subtitle: { fontSize: 14, color: '#C0BDCF', lineHeight: 21, marginTop: 10 },
  artRow: { alignItems: 'center', backgroundColor: '#1B1B26', borderRadius: 18, marginBottom: 16 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  heading: { fontFamily: 'Nunito_700Bold', fontSize: 32, color: '#65F3FF' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: '#060609', marginRight: 8 },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#C0BDCF' },
  filterChipTextActive: { color: '#17200C' },
  claimBanner: { backgroundColor: '#302719', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12 },
  claimBannerText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFE177' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  taskCard: { flexDirection: 'row', backgroundColor: '#121219', borderRadius: 24, borderWidth: 1, borderColor: '#333240', marginBottom: 16, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.06, shadowColor: 'rgba(26,62,110,0.12)', elevation: 1, overflow: 'hidden' },
  taskCardClaimed: { opacity: 0.5 },
  categoryBorder: { width: 4, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  taskContent: { flex: 1, padding: 14 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  categoryIcon: {color:'#F7F5FF', fontSize: 16 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryBadgeText: {color:'#F7F5FF', fontFamily: 'Inter_500Medium', fontSize: 11 },
  milestoneBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#302445' },
  milestoneBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#B7A1FF' },
  taskTitle: { fontFamily: 'Nunito_700Bold', fontSize: 23, color: '#F7F5FF', marginBottom: 8 },
  taskTitleClaimed: { color: '#A9A7BA' },
  taskDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#C0BDCF', marginBottom: 8 },
  taskFooter: { flexWrap: 'wrap', gap: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starValue: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: '#FFE177' },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  difficultyText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#F7F5FF' },
  lockedText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#A9A7BA', marginTop: 6 },
  myClaimText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#FFE177', marginTop: 6 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyEmoji: {color:'#F7F5FF', fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#C0BDCF', textAlign: 'center', lineHeight: 24 },
});
