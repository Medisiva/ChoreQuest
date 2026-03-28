// Badge unlock overlay with gold shimmer border and scale-in animation.
// Displays when a child earns a new badge/achievement.

import { useEffect, useCallback } from 'react';
import { StyleSheet, TouchableWithoutFeedback, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
} from 'react-native-reanimated';
import { colors, spacing, typography, animation, radius } from '../../constants/tokens';

interface BadgeUnlockOverlayProps {
  badgeId: string;
  badgeName: string;
  badgeDescription: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 3000;

// Map badge IDs to emoji icons (placeholder — will be replaced with real assets)
function getBadgeEmoji(badgeId: string): string {
  const map: Record<string, string> = {
    firstTask: '🌟',
    fiveTasks: '🏅',
    tenTasks: '🎖️',
    streak3: '🔥',
    streak7: '💪',
    earlyBird: '🌅',
    nightOwl: '🦉',
    helper: '🤝',
    explorer: '🧭',
    champion: '🏆',
  };
  return map[badgeId] ?? '🏅';
}

export default function BadgeUnlockOverlay({
  badgeId,
  badgeName,
  badgeDescription,
  onDismiss,
}: BadgeUnlockOverlayProps) {
  const overlayOpacity = useSharedValue(0);
  const badgeScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const shimmerOpacity = useSharedValue(0.4);

  const handleDismiss = useCallback(() => {
    overlayOpacity.value = withTiming(0, { duration: 200 });
    badgeScale.value = withTiming(0, { duration: 200 });
    textOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onDismiss, 220);
  }, [onDismiss, overlayOpacity, badgeScale, textOpacity]);

  useEffect(() => {
    // Fade in overlay
    overlayOpacity.value = withTiming(1, { duration: 200 });

    // Scale in badge with bouncy spring
    badgeScale.value = withDelay(
      200,
      withSpring(1, animation.springBouncy)
    );

    // Fade in text
    textOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));

    // Gold shimmer border: oscillating opacity
    shimmerOpacity.value = withDelay(
      300,
      withRepeat(withTiming(1, { duration: 800 }), -1, true)
    );

    const timer = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [overlayOpacity, badgeScale, textOpacity, shimmerOpacity, handleDismiss]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    borderColor: colors.starGold,
    borderWidth: 3,
    opacity: shimmerOpacity.value,
  }));

  const emoji = getBadgeEmoji(badgeId);

  return (
    <TouchableWithoutFeedback onPress={handleDismiss}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {/* Badge icon with shimmer border */}
        <Animated.View style={[styles.badgeContainer, badgeStyle]}>
          <Animated.View style={[styles.shimmerBorder, shimmerStyle]}>
            <View style={styles.badgeInner}>
              <Text style={styles.badgeEmoji}>{emoji}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Text content */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={styles.heading}>New Badge!</Text>
          <Text style={styles.badgeName}>{badgeName}</Text>
          <Text style={styles.badgeDescription}>{badgeDescription}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  badgeContainer: {
    marginBottom: spacing[8],
  },
  shimmerBorder: {
    borderRadius: radius.full,
    padding: spacing[2],
  },
  badgeInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeEmoji: {
    fontSize: 64,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  heading: {
    ...typography.childDisplay,
    color: colors.starGold,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  badgeName: {
    ...typography.childHeading1,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  badgeDescription: {
    ...typography.childBody,
    color: colors.ink400,
    textAlign: 'center',
  },
});
