// S1-Tab: Parent mode bottom tab navigator (WFB-001)
// 5 tabs: Dashboard, Tasks, Accountability, Requests, Profile
// Uses Expo Router Tabs with design tokens from DS-001

import { Tabs } from 'expo-router';
import { Text, StyleSheet, View } from 'react-native';
import { colors, layout, typography } from '../../../src/constants/tokens';

type TabIconProps = {
  emoji: string;
  focused: boolean;
};

function TabIcon({ emoji, focused }: TabIconProps) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Text style={styles.icon}>{emoji}</Text>
    </View>
  );
}

export default function ParentLayout() {
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
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.ink50,
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
