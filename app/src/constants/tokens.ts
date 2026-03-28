// S1-02: Design tokens from DS-001 Section 9
// Single source of truth for all visual design values.
// Import tokens everywhere — never hard-code a hex value or pixel value.

export const colors = {
  // Brand
  navy900: '#1A3E6E',
  navy700: '#2E6DB4',
  navy500: '#4A90D9',
  navy50: '#E8F2FB',
  ink950: '#1A1A2E',
  ink600: '#555555',
  ink400: '#9CA3AF',
  ink50: '#F8FAFC',
  // Child accents
  starGold: '#FFD700',
  coral: '#FF6B6B',
  skyBlue: '#4FC3F7',
  softPurple: '#A78BFA',
  cloud: '#F0F9FF',
  cream: '#FFF8DC',
  blush: '#FFF0F6',
  // Categories
  householdDeep: '#1B6CA8',
  householdLight: '#DBEAFE',
  learningDeep: '#7B2D8B',
  learningLight: '#EDE9FE',
  lifeDeep: '#0D7377',
  lifeLight: '#CCFBF1',
  hobbiesDeep: '#B85C00',
  hobbiesLight: '#FFEDD5',
  // Semantic
  success: '#1B7A34',
  successLight: '#D1FAE5',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  danger: '#9B1C1C',
  dangerLight: '#FEE2E2',
  amber: '#92400E',
  amberLight: '#FFFBEB',
  white: '#FFFFFF',
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const layout = {
  screenPadding: 16,
  cardGap: 12,
  sectionGap: 24,
  tabBarHeight: 80,
  headerHeight: 56,
  minTapTarget: 48,
  minTapTargetParent: 44,
} as const;

export const typography = {
  // Parent mode (Inter)
  display1: { fontFamily: 'Inter_700Bold', fontSize: 36, lineHeight: 45 },
  heading1: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 35 },
  heading2: { fontFamily: 'Inter_600SemiBold', fontSize: 22, lineHeight: 27 },
  heading3: { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 22 },
  body1: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  body2: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 17 },
  button: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 20 },
  // Child mode (Nunito for display/headings)
  childDisplay: { fontFamily: 'Nunito_800ExtraBold', fontSize: 40, lineHeight: 50 },
  childHeading1: { fontFamily: 'Nunito_700Bold', fontSize: 28, lineHeight: 35 },
  childHeading2: { fontFamily: 'Nunito_700Bold', fontSize: 22, lineHeight: 27 },
  childBody: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  childLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 17 },
  childButton: { fontFamily: 'Nunito_700Bold', fontSize: 18, lineHeight: 22 },
  childCounter: { fontFamily: 'Nunito_800ExtraBold', fontSize: 52, lineHeight: 65 },
} as const;

export const animation = {
  durationInstant: 100,
  durationFast: 150,
  durationStandard: 200,
  durationSlow: 300,
  durationEnter: 350,
  celebrationShort: 600,
  celebrationLong: 1200,
  // Spring configs for Reanimated
  springSnappy: { damping: 20, stiffness: 300 },
  springBouncy: { damping: 15, stiffness: 200 },
  springGentle: { damping: 25, stiffness: 150 },
} as const;

export const shadows = {
  elevation1: {
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: 0.06,
    shadowColor: 'rgba(26, 62, 110, 0.12)',
  },
  elevation2: {
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.1,
    shadowColor: 'rgba(26, 62, 110, 0.12)',
  },
  elevation3: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.15,
    shadowColor: 'rgba(26, 62, 110, 0.12)',
  },
  elevation4: {
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.2,
    shadowColor: 'rgba(26, 62, 110, 0.12)',
  },
} as const;

export const categoryColors = {
  Household: { deep: colors.householdDeep, light: colors.householdLight, icon: '🏠' },
  Learning: { deep: colors.learningDeep, light: colors.learningLight, icon: '📚' },
  LifeSkills: { deep: colors.lifeDeep, light: colors.lifeLight, icon: '🌱' },
  Hobbies: { deep: colors.hobbiesDeep, light: colors.hobbiesLight, icon: '🎨' },
} as const;
