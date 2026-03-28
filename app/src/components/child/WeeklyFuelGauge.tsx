// Sprint 6: Illustrated fuel gauge with three themed variants.
// Uses emoji placeholders for rocket / potion / treasure themes.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, radius, typography, animation } from '../../constants/tokens';

type GaugeTheme = 'rocket' | 'potion' | 'treasure';

interface WeeklyFuelGaugeProps {
  current: number;
  target: number;
  theme: GaugeTheme;
}

const THEME_CONFIG: Record<GaugeTheme, { emoji: string; label: string; fillColor: string; trackColor: string }> = {
  rocket: {
    emoji: '🚀',
    label: 'Fuel Tank',
    fillColor: colors.skyBlue,
    trackColor: '#E0F2FE',
  },
  potion: {
    emoji: '🧪',
    label: 'Magic Potion',
    fillColor: colors.softPurple,
    trackColor: '#EDE9FE',
  },
  treasure: {
    emoji: '💰',
    label: 'Treasure Chest',
    fillColor: colors.starGold,
    trackColor: colors.cream,
  },
};

export default function WeeklyFuelGauge({ current, target, theme }: WeeklyFuelGaugeProps) {
  const safeTarget = Math.max(target, 1);
  const progress = Math.min(current / safeTarget, 1);
  const met = current >= safeTarget;
  const config = THEME_CONFIG[theme];

  const animatedHeight = useAnimatedStyle(() => ({
    height: withTiming(`${progress * 100}%`, {
      duration: animation.durationSlow,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{config.emoji}</Text>
      <Text style={styles.label}>{config.label}</Text>

      <View style={[styles.tank, { backgroundColor: config.trackColor }]}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: config.fillColor },
            animatedHeight,
          ]}
        />
        {met && (
          <View style={styles.fullOverlay}>
            <Text style={styles.fullText}>FULL!</Text>
          </View>
        )}
      </View>

      <Text style={styles.count}>
        {current} / {target}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  emoji: {
    fontSize: 36,
    marginBottom: spacing[1],
  },
  label: {
    ...typography.childLabel,
    color: colors.ink600,
    marginBottom: spacing[2],
  },
  tank: {
    width: spacing[16],
    height: 120,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: colors.ink400,
  },
  fill: {
    width: '100%',
    borderRadius: radius.lg - 2,
  },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullText: {
    ...typography.childHeading2,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  count: {
    ...typography.childLabel,
    color: colors.ink950,
    marginTop: spacing[2],
  },
});
