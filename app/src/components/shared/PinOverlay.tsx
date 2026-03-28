// PIN entry overlay for child profile access
// Full-screen modal slides up with Reanimated.
// Shows child avatar + nickname, 4 large circular PIN dots, number pad.
// Shake animation on error. Lock icon after 3 fails.

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  SlideInDown,
} from 'react-native-reanimated';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { functions } from '../../services/firebase';
import type { ChildProfile } from '../../types';

interface PinOverlayProps {
  child: ChildProfile;
  onSuccess: (sessionToken: string) => void;
  onCancel: () => void;
}

export default function PinOverlay({
  child,
  onSuccess,
  onCancel,
}: PinOverlayProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [locked, setLocked] = useState(false);

  const shakeX = useSharedValue(0);

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  }, [shakeX]);

  const handleDigitPress = useCallback(
    async (digit: string) => {
      if (loading || locked) return;

      const newPin = pin + digit;
      setPin(newPin);
      setError(null);

      if (newPin.length === 4) {
        setLoading(true);

        try {
          // Call the verifyChildPin Cloud Function
          const response = await fetch(
            `${__DEV__ ? 'http://localhost:5001' : ''}/chorequest-prod/us-central1/verifyChildPin`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                familyId: child.familyAccountId,
                childProfileId: child.id,
                pin: newPin,
              }),
            }
          );

          const result = await response.json();

          if (result.success) {
            onSuccess(result.sessionToken);
          } else if (result.locked) {
            setLocked(true);
            setError('Too many attempts. Ask a parent to unlock.');
            triggerShake();
          } else {
            setAttemptsRemaining(result.attemptsRemaining ?? 0);
            setError(
              `Wrong PIN. ${result.attemptsRemaining ?? 0} attempt${(result.attemptsRemaining ?? 0) !== 1 ? 's' : ''} remaining.`
            );
            triggerShake();
          }
        } catch (err) {
          setError('Could not verify PIN. Try again.');
          triggerShake();
        }

        setPin('');
        setLoading(false);
      }
    },
    [pin, loading, locked, child, onSuccess, triggerShake]
  );

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !loading) {
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin, loading]);

  const renderDot = (index: number) => {
    const filled = index < pin.length;
    const isError = error !== null;
    return (
      <View
        key={index}
        style={[
          styles.dot,
          filled && styles.dotFilled,
          isError && filled && styles.dotError,
        ]}
      />
    );
  };

  return (
    <Modal
      visible
      animationType="none"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(300)}
          style={styles.sheet}
        >
          {/* Child Info */}
          <View style={styles.childInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>😊</Text>
            </View>
            <Text style={styles.childName}>{child.nickname}</Text>
          </View>

          {/* PIN Dots */}
          <Animated.View style={[styles.dotsRow, dotAnimatedStyle]}>
            {[0, 1, 2, 3].map(renderDot)}
          </Animated.View>

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Loading */}
          {loading && (
            <ActivityIndicator
              size="small"
              color="#1A3E6E"
              style={styles.loader}
            />
          )}

          {/* Locked State */}
          {locked ? (
            <View style={styles.lockedContainer}>
              <Text style={styles.lockedIcon}>🔒</Text>
              <Text style={styles.lockedText}>
                Ask a parent to unlock
              </Text>
            </View>
          ) : (
            /* Number Pad */
            <View style={styles.numPad}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['', '0', '⌫'],
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.numRow}>
                  {row.map((digit) => {
                    if (digit === '') {
                      return <View key="empty" style={styles.numKey} />;
                    }
                    if (digit === '⌫') {
                      return (
                        <TouchableOpacity
                          key="delete"
                          style={styles.numKey}
                          onPress={handleDelete}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.numKeyText}>⌫</Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={digit}
                        style={styles.numKey}
                        onPress={() => handleDigitPress(digit)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.numKeyText}>{digit}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* Cancel */}
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
            activeOpacity={0.6}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  childInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  childName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#1A1A2E',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1A3E6E',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#1A3E6E',
  },
  dotError: {
    backgroundColor: '#9B1C1C',
    borderColor: '#9B1C1C',
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#9B1C1C',
    marginBottom: 8,
  },
  loader: {
    marginBottom: 8,
  },
  lockedContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  lockedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  lockedText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#555555',
  },
  numPad: {
    marginTop: 8,
    gap: 12,
  },
  numRow: {
    flexDirection: 'row',
    gap: 24,
  },
  numKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numKeyText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: '#1A1A2E',
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  cancelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#4A90D9',
  },
});
