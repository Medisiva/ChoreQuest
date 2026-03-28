// Sprint 6: Weekly progress bar widget for child dashboard
// Blue when on track, amber when behind, gold + sparkle when target met.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, radius, typography, animation } from '../../constants/tokens';

interface WeeklyProgressBarProps {
  current: number;
  target: number;
}

export default function WeeklyProgressBar({ current, target }: WeeklyProgressBarProps) {
  const safeTarget = Math.max(target, 1);
  const progress = Math.min(current / safeTarget, 1);
  const met = current >= safeTarget;
  const behind = progress < 0.5 && !met;

  const barColor = met
    ? colors.starGold
    : behind
      ? colors.warning
      : colors.navy500;

  const animatedWidth = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%`, {
      duration: animation.durationSlow,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {met ? 'Target met! ' : `${current} / ${target} stars`}
          {met && '✨'}
        </Text>
        <Text style={styles.percentage}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: barColor },
            animatedWidth,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  label: {
    ...typography.childLabel,
    color: colors.ink950,
  },
  percentage: {
    ...typography.caption,
    color: colors.ink600,
  },
  track: {
    height: spacing[3],
    backgroundColor: colors.navy50,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
