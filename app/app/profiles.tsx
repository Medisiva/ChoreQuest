// S1-11: Profile Selector screen (PS-01)
// Hub screen shown after parent authenticates.
// Parent tiles (no PIN) and child tiles (PIN required).
// PIN overlay slides up on child tile tap.
// Correct routing: parent tap → dashboard, successful PIN → child home.

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
import { useFamilyStore } from '../src/stores/familyStore';
import { useAuthStore } from '../src/stores/authStore';
import { useChildSessionStore } from '../src/stores/childSessionStore';
import PinOverlay from '../src/components/shared/PinOverlay';
import type { ChildProfile } from '../src/types';

export default function ProfileSelector() {
  const router = useRouter();
  const { family, children, parentProfile, loading } = useFamilyStore();
  const { user } = useAuthStore();
  const { startSession } = useChildSessionStore();

  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [showPin, setShowPin] = useState(false);

  const handleParentTap = useCallback(() => {
    router.push('/(parent)/dashboard');
  }, [router]);

  const handleChildTap = useCallback((child: ChildProfile) => {
    setSelectedChild(child);
    setShowPin(true);
  }, []);

  const handlePinSuccess = useCallback(
    (sessionToken: string) => {
      if (selectedChild) {
        startSession(selectedChild.id, sessionToken);
        setShowPin(false);
        setSelectedChild(null);
        router.push('/(child)/home');
      }
    },
    [selectedChild, startSession, router]
  );

  const handlePinCancel = useCallback(() => {
    setShowPin(false);
    setSelectedChild(null);
  }, []);

  const handleAddChild = useCallback(() => {
    router.push('/(parent)/children/create' as never);
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1A3E6E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.heading}>Who's using ChoreQuest?</Text>
        {family && (
          <Text style={styles.familyName}>{family.familyName}</Text>
        )}

        {/* Parent Tiles */}
        <Text style={styles.sectionLabel}>Parents</Text>
        <View style={styles.tilesRow}>
          {parentProfile && (
            <TouchableOpacity
              style={styles.tile}
              onPress={handleParentTap}
              activeOpacity={0.7}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <Text style={styles.tileName}>
                {parentProfile.displayName}
              </Text>
              <Text style={styles.tileLabel}>Parent</Text>
              <Text style={styles.tileStars}>
                ⭐ {parentProfile.starBalance}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Child Tiles */}
        {children.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Kids</Text>
            <View style={styles.tilesRow}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={styles.tile}
                  onPress={() => handleChildTap(child)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarCircle, styles.childAvatar]}>
                    <Text style={styles.avatarEmoji}>😊</Text>
                  </View>
                  <Text style={styles.tileName}>{child.nickname}</Text>
                  <Text style={styles.tileLabel}>{child.ageGroup}</Text>
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
    backgroundColor: '#F8FAFC', // ink50
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 35,
    color: '#1A1A2E', // ink950
    marginTop: 32,
    textAlign: 'center',
  },
  familyName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#555555', // ink600
    marginTop: 8,
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#9CA3AF', // ink400
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
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    backgroundColor: '#E8F2FB', // navy50
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  childAvatar: {
    backgroundColor: '#F0F9FF', // cloud
  },
  avatarEmoji: {
    fontSize: 28,
  },
  tileName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#1A1A2E', // ink950
    marginBottom: 4,
  },
  tileLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#9CA3AF', // ink400
    marginBottom: 8,
  },
  tileFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  tileStars: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#1A3E6E', // navy900
  },
  tileStreak: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#FF6B6B', // coral
  },
  addChildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8F2FB', // navy50
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addChildIcon: {
    fontSize: 20,
    color: '#4A90D9', // blue500
    fontWeight: '700',
  },
  addChildText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#4A90D9', // blue500
  },
});
