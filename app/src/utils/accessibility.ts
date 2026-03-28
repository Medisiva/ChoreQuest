// S11: Accessibility utilities
// Consistent accessibility props for common patterns.

import { AccessibilityRole } from 'react-native';

export function a11yButton(label: string) {
  return {
    accessible: true,
    accessibilityRole: 'button' as AccessibilityRole,
    accessibilityLabel: label,
  };
}

export function a11yHeader(label: string) {
  return {
    accessible: true,
    accessibilityRole: 'header' as AccessibilityRole,
    accessibilityLabel: label,
  };
}

export function a11yImage(label: string) {
  return {
    accessible: true,
    accessibilityRole: 'image' as AccessibilityRole,
    accessibilityLabel: label,
  };
}

export function a11yProgress(label: string, value: number, max: number) {
  return {
    accessible: true,
    accessibilityRole: 'progressbar' as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityValue: {
      min: 0,
      max,
      now: value,
      text: `${value} of ${max}`,
    },
  };
}

export function a11yTab(label: string, selected: boolean) {
  return {
    accessible: true,
    accessibilityRole: 'tab' as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityState: { selected },
  };
}
