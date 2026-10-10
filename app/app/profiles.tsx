import PlaygroundHero from '@/components/shared/PlaygroundHero';
import KidAvatar from '@/components/shared/KidAvatar';
// S1-11: Profile Selector screen (PS-01)
// Hub screen shown after parent authenticates.
// Parent tiles (no PIN) and child tiles (PIN required).
// PIN overlay slides up on child tile tap.
// Correct routing: parent tap → dashboard, successful PIN → child home.

import { enterChildMode } from '@/services/auth';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/familyStore';
import { useChildSessionStore } from '@/stores/childSessionStore';
import PinOverlay from '@/components/shared/PinOverlay';
import type { ChildProfile } from '@/types';

export default function ProfileSelector() {
  const router = useRouter();
  const { family, children, parentProfile, loading } = useFamilyStore();
  const { parentLocked } = useChildSessionStore();

  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [showPin, setShowPin] = useState(false);

  const handleParentTap = useCallback(() => {
    router.push(parentLocked ? '/parent-unlock' : '/(parent)/dashboard');
  }, [router, parentLocked]);

  const handleChildTap = useCallback((child: ChildProfile) => {
    if (parentLocked) { router.push('/parent-unlock'); return; }
    setSelectedChild(child);
    setShowPin(true);
  }, [parentLocked, router]);

  const handlePinSuccess = useCallback(
    async (sessionToken: string, customToken: string) => {
      if (selectedChild) {
        await enterChildMode(selectedChild.id, sessionToken, customToken);
        setShowPin(false);
        setSelectedChild(null);
        router.push('/(child)/home');
      }
    },
    [selectedChild, router]
  );

  const handlePinCancel = useCallback(() => {
    setShowPin(false);
    setSelectedChild(null);
  }, []);

  const handleAddChild = useCallback(() => {
    router.push(parentLocked ? '/parent-unlock' : '/(parent)/children/create' as never);
  }, [router, parentLocked]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1555E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <PlaygroundHero title="Pick your player!" subtitle="A little helping. A lot of happy." />
        {family && (
          <Text style={styles.familyName}>{family.familyName}</Text>
        )}

        {/* Parent Tiles */}
        <Text style={styles.sectionLabel}>Parents</Text>
        <View style={styles.tilesRow}>
            <TouchableOpacity
              style={styles.tile}
              onPress={handleParentTap}
              activeOpacity={0.7}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <Text style={styles.tileName}>
                {parentProfile?.displayName ?? 'Parent access'}
              </Text>
              <Text style={styles.tileLabel}>Parent</Text>
              <Text style={styles.tileStars}>
                ⭐ {parentProfile?.starBalance ?? 0}
              </Text>
            </TouchableOpacity>
        </View>

        {/* Child Tiles */}
        {children.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Kids</Text>
            <View style={styles.tilesRow}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[styles.tile, { backgroundColor: children.indexOf(child) % 2 ? '#FFF1B8' : '#D9F7EC' }]}
                  onPress={() => handleChildTap(child)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarCircle, styles.childAvatar]}>
                    <KidAvatar avatarId={child.avatarId} size={64} />
                  </View>
                  <Text style={styles.tileName}>{child.nickname}</Text>
                  <Text style={styles.tileLabel}>Kid access · PIN needed</Text>
                  <View style={styles.tileFooter}>
                    <Text style={styles.tileStars}>
                      ⭐ {child.starBalance}
                    </Text>
                    {child.currentStreakWeeks > 0 && (
                      <Text style={styles.tileStreak}>
                        🔥 {child.currentStreakWeeks}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Add Child Button */}
        <TouchableOpacity
          style={styles.addChildButton}
          onPress={handleAddChild}
          activeOpacity={0.7}
        >
          <Text style={styles.addChildIcon}>+</Text>
          <Text style={styles.addChildText}>Add a child</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* PIN Overlay */}
      {showPin && selectedChild && (
        <PinOverlay
          child={selectedChild}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FF', // ink50
  },
  content: {
    padding: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 35,
    color: '#16244D', // ink950
    marginTop: 32,
    textAlign: 'center',
  },
  familyName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#4B5875', // ink600
    marginTop: 8,
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: '#6C7893', // ink400
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  tilesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
    justifyContent: 'center',
  },
  tile: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.1,
    shadowColor: 'rgba(26, 62, 110, 0.12)',
    elevation: 2,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5EFFF', // navy50
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  childAvatar: {
    backgroundColor: '#EEF6FF', // cloud
  },
  avatarEmoji: {
    fontSize: 28,
  },
  tileName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: '#16244D', // ink950
    marginBottom: 4,
  },
  tileLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6C7893', // ink400
    marginBottom: 8,
  },
  tileFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  tileStars: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#1555E8', // navy900
  },
  tileStreak: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#FF6688', // coral
  },
  addChildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5EFFF', // navy50
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addChildIcon: {
    fontSize: 20,
    color: '#2563EB', // blue500
    fontWeight: '700',
  },
  addChildText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#2563EB', // blue500
  },
});
