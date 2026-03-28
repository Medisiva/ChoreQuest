// S2-02: Avatar Picker component
// Grid of 20+ illustrated avatar options using FlashList.
// Selected state with category-color ring border + checkmark overlay.

import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';

// 20 avatar options — emoji-based for now, can be replaced with PNGs later
const AVATARS = [
  { id: 'avatar-01', emoji: '😊' },
  { id: 'avatar-02', emoji: '😎' },
  { id: 'avatar-03', emoji: '🦁' },
  { id: 'avatar-04', emoji: '🐱' },
  { id: 'avatar-05', emoji: '🐶' },
  { id: 'avatar-06', emoji: '🦊' },
  { id: 'avatar-07', emoji: '🐰' },
  { id: 'avatar-08', emoji: '🐼' },
  { id: 'avatar-09', emoji: '🦄' },
  { id: 'avatar-10', emoji: '🐸' },
  { id: 'avatar-11', emoji: '🦋' },
  { id: 'avatar-12', emoji: '🌟' },
  { id: 'avatar-13', emoji: '🚀' },
  { id: 'avatar-14', emoji: '🎨' },
  { id: 'avatar-15', emoji: '⚽' },
  { id: 'avatar-16', emoji: '🎸' },
  { id: 'avatar-17', emoji: '🧩' },
  { id: 'avatar-18', emoji: '🌈' },
  { id: 'avatar-19', emoji: '🎯' },
  { id: 'avatar-20', emoji: '🏆' },
] as const;

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (avatarId: string) => void;
  accentColor?: string;
}

export default function AvatarPicker({
  selectedId,
  onSelect,
  accentColor = '#4A90D9',
}: AvatarPickerProps) {
  const renderItem = useCallback(
    ({ item }: { item: (typeof AVATARS)[number] }) => {
      const isSelected = item.id === selectedId;
      return (
        <TouchableOpacity
          style={[
            styles.avatarCell,
            isSelected && { borderColor: accentColor, borderWidth: 3 },
          ]}
          onPress={() => onSelect(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.avatarEmoji}>{item.emoji}</Text>
          {isSelected && (
            <View style={[styles.checkmark, { backgroundColor: accentColor }]}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedId, onSelect, accentColor]
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={AVATARS}
        renderItem={renderItem}
        estimatedItemSize={80}
        numColumns={4}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />
    </View>
  );
}

export { AVATARS };

const styles = StyleSheet.create({
  container: {
    height: 420,
  },
  avatarCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarEmoji: {
    fontSize: 36,
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
