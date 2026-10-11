// S1-02: Design tokens from DS-001 Section 9
// Single source of truth for all visual design values.
// Import tokens everywhere — never hard-code a hex value or pixel value.

export const colors = {
  background: '#060609',
  surface: '#121219',
  surfaceRaised: '#1B1B26',
  border: '#333240',
  onAccent: '#17200C',
  hero: '#382153',
  lime: '#CDFF65',
  // Brand
  navy900: '#65F3FF',
  navy700: '#65F3FF',
  navy500: '#65F3FF',
  navy50: '#17363A',
  ink950: '#F7F5FF',
  ink600: '#C0BDCF',
  ink400: '#A9A7BA',
  ink50: '#23232F',
  // Child accents
  starGold: '#FFE177',
  coral: '#FF76C5',
  skyBlue: '#65F3FF',
  softPurple: '#B7A1FF',
  cloud: '#060609',
  cream: '#302719',
  blush: '#341C2D',
  // Categories
  householdDeep: '#65F3FF',
  householdLight: '#17363A',
  learningDeep: '#B7A1FF',
  learningLight: '#302445',
  lifeDeep: '#CDFF65',
  lifeLight: '#26351D',
  hobbiesDeep: '#FFBA82',
  hobbiesLight: '#392719',
  // Semantic
  success: '#CDFF65',
  successLight: '#26351D',
  warning: '#FFE177',
  warningLight: '#302719',
  danger: '#FF92A7',
  dangerLight: '#391D2B',
  amber: '#FFE177',
  amberLight: '#302719',
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
  md: 16,
  lg: 22,
  xl: 28,
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
