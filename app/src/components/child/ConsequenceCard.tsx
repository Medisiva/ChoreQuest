// Sprint 6: Red-bordered consequence card for child home screen.
// Non-dismissable — child must talk to parent.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography, shadows } from '../../constants/tokens';

interface ConsequenceCardProps {
  name: string;
  description: string;
}

export default function ConsequenceCard({ name, description }: ConsequenceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>{name}</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.footer}>
        <Text style={styles.footerIcon}>💬</Text>
        <Text style={styles.footerText}>Talk to your parent</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dangerLight,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing[4],
    ...shadows.elevation2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  icon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  title: {
    ...typography.childHeading2,
    color: colors.danger,
    flex: 1,
  },
  description: {
    ...typography.childBody,
    color: colors.ink950,
    marginBottom: spacing[3],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.danger,
  },
  footerIcon: {
    fontSize: 16,
    marginRight: spacing[2],
  },
  footerText: {
    ...typography.childLabel,
    color: colors.danger,
  },
});
