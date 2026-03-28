// Sprint 6: Large countdown display — "N stars to go!" or gold "Done!" state.
// Uses Nunito ExtraBold per the child typography spec.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing, typography, animation } from '../../constants/tokens';

interface WeeklyCountdownProps {
  current: number;
  target: number;
}

export default function WeeklyCountdown({ current, target }: WeeklyCountdownProps) {
  const remaining = Math.max(target - current, 0);
  const met = remaining === 0;

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(met ? 1.1 : 1, animation.springBouncy),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.numberContainer, scaleStyle]}>
        <Text style={[styles.number, met && styles.numberMet]}>
          {met ? '0' : remaining}
        </Text>
      </Animated.View>
      <Text style={[styles.subtitle, met && styles.subtitleMet]}>
        {met ? 'Target reached! You did it!' : 'stars to go!'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  numberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    ...typography.childCounter,
    color: colors.navy900,
  },
  numberMet: {
    color: colors.starGold,
  },
  subtitle: {
    ...typography.childHeading2,
    color: colors.ink600,
    marginTop: spacing[1],
  },
  subtitleMet: {
    color: colors.starGold,
  },
});
