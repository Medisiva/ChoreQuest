// Full-screen celebration overlay with confetti and star burst animations.
// Used for task completions, badge unlocks, and other achievements.

import { useEffect, useCallback } from 'react';
import { StyleSheet, TouchableWithoutFeedback, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { colors, spacing, typography, animation } from '../../constants/tokens';

interface CelebrationOverlayProps {
  visible: boolean;
  message: string;
  subMessage?: string;
  onDismiss: () => void;
}

const CONFETTI_COUNT = 20;
const AUTO_DISMISS_MS = 2500;

const CONFETTI_COLORS = [
  colors.starGold,
  colors.coral,
  colors.skyBlue,
  colors.softPurple,
  colors.success,
];

// Pre-generate random values for confetti particles
const confettiSeeds = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  x: Math.random() * 100, // percentage across screen
  delay: Math.random() * 600,
  duration: 1200 + Math.random() * 800,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 8 + Math.random() * 8,
}));

function ConfettiParticle({
  seed,
  visible,
}: {
  seed: (typeof confettiSeeds)[number];
  visible: boolean;
}) {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(seed.delay, withTiming(1, { duration: 150 }));
      translateY.value = withDelay(
        seed.delay,
        withTiming(800, { duration: seed.duration })
      );
    } else {
      translateY.value = -20;
      opacity.value = 0;
    }
  }, [visible, seed.delay, seed.duration, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          left: `${seed.x}%`,
          width: seed.size,
          height: seed.size,
          borderRadius: seed.size / 2,
          backgroundColor: seed.color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function CelebrationOverlay({
  visible,
  message,
  subMessage,
  onDismiss,
}: CelebrationOverlayProps) {
  const overlayOpacity = useSharedValue(0);
  const starScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    overlayOpacity.value = withTiming(0, { duration: 200 });
    starScale.value = withTiming(0, { duration: 200 });
    textOpacity.value = withTiming(0, { duration: 200 });
    // Small delay to let fade-out play before calling onDismiss
    setTimeout(onDismiss, 220);
  }, [onDismiss, overlayOpacity, starScale, textOpacity]);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      starScale.value = withDelay(
        200,
        withSpring(1, animation.springBouncy)
      );
      textOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));

      const timer = setTimeout(() => {
        handleDismiss();
      }, AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    } else {
      overlayOpacity.value = 0;
      starScale.value = 0;
      textOpacity.value = 0;
    }
  }, [visible, overlayOpacity, starScale, textOpacity, handleDismiss]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={handleDismiss}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {/* Confetti */}
        {confettiSeeds.map((seed, index) => (
          <ConfettiParticle key={index} seed={seed} visible={visible} />
        ))}

        {/* Star burst */}
        <Animated.View style={[styles.starContainer, starStyle]}>
          <Text style={styles.starEmoji}>⭐</Text>
        </Animated.View>

        {/* Message text */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={styles.messageText}>{message}</Text>
          {subMessage && (
            <Text style={styles.subMessageText}>{subMessage}</Text>
          )}
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confettiParticle: {
    position: 'absolute',
    top: -20,
  },
  starContainer: {
    marginBottom: spacing[6],
  },
  starEmoji: {
    fontSize: 80,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  messageText: {
    ...typography.childDisplay,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  subMessageText: {
    ...typography.childHeading2,
    color: colors.starGold,
    textAlign: 'center',
  },
});
