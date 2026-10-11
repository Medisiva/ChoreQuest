import { Home, Flag, UserRound, ChartNoAxesColumnIncreasing, MessagesSquare } from 'lucide-react-native';
// S1-Tab: Parent mode bottom tab navigator (WFB-001)
// 5 tabs: Dashboard, Tasks, Accountability, Requests, Profile
// Uses Expo Router Tabs with design tokens from DS-001

import { useAuthStore } from '@/stores/authStore';
import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useChildSessionStore } from '@/stores/childSessionStore';
import { colors, layout, typography } from '@/constants/tokens';

type TabIconProps = {
  emoji: string;
  focused: boolean;
};

function TabIcon({ emoji, focused }: TabIconProps) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      {(() => { const Icon = emoji === '🏠' ? Home : emoji === '📋' ? Flag : emoji === '📊' ? ChartNoAxesColumnIncreasing : emoji === '📥' ? MessagesSquare : UserRound; return <Icon size={23} color={focused ? colors.skyBlue : colors.ink400} />; })()}
    </View>
  );
}

export default function ParentLayout() {
  const parentLocked = useChildSessionStore((state) => state.parentLocked);
  const role = useAuthStore((state) => state.role);
  if (parentLocked || role !== 'parent') return <Redirect href="/parent-unlock" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.navy900,
        tabBarInactiveTintColor: colors.ink400,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="accountability"
        options={{
          title: 'Accountability',
          tabBarLabel: 'Progress',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📥" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
      {/* Hidden routes — navigable via router.push() but not shown in tab bar */}
      <Tabs.Screen
        name="leaderboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="children"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="approvals"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="rewards"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: layout.tabBarHeight,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 16,
  },
  tabBarLabel: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
  },
  iconContainer: {
    width: layout.minTapTargetParent,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    opacity: 1,
  },
  icon: {
    fontSize: 22,
  },
});
