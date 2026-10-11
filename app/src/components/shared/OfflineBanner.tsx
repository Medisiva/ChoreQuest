// S10: Offline banner — shown when device loses connectivity

import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withDelay,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface OfflineBannerProps {
  isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const translateY = useSharedValue(-50);

  useEffect(() => {
    translateY.value = isOnline
      ? withDelay(300, withTiming(-50, { duration: 200 }))
      : withTiming(0, { duration: 200 });
  }, [isOnline, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Remove the hidden announcement from the web accessibility tree as well.
  if (isOnline) return null;

  return (
    <Animated.View pointerEvents="none" accessibilityRole="alert" accessibilityElementsHidden={isOnline} importantForAccessibility={isOnline ? "no-hide-descendants" : "yes"} style={[styles.banner, animatedStyle]}>
      <Text style={styles.text}>You&apos;re offline. Reconnect before sending or saving.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFE177',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  text: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#17200C',
    textAlign: 'center',
  },
});
