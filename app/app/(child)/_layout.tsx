// S1-Tab: Child mode bottom tab navigator (WFB-001)
// 4 tabs: Home, Quests, Rewards, Me
// Uses Expo Router Tabs with design tokens from DS-001
// Active color varies per tab, no labels, larger icons, 48dp tap targets

import { Tabs, Redirect } from 'expo-router';
import { Text, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useChildSessionStore } from '@/stores/childSessionStore';
import { colors, layout } from '@/constants/tokens';

const TAB_COLORS = {
  home: colors.starGold,
  tasks: colors.coral,
  rewards: colors.softPurple,
  profile: colors.skyBlue,
} as const;

type ChildTabIconProps = {
  emoji: string;
  focused: boolean;
  activeColor: string;
};

function ChildTabIcon({ emoji, focused, activeColor }: ChildTabIconProps) {
  return (
    <View
      style={[
        styles.iconContainer,
        focused && { backgroundColor: activeColor + '20' },
      ]}
    >
      <Text style={[styles.icon, focused && styles.iconActive]}>{emoji}</Text>
    </View>
  );
}

export default function ChildLayout() {
  const { activeChildId, sessionExpiry, endSession } = useChildSessionStore();
  useEffect(() => {
    if (!sessionExpiry) return;
    const timer = setTimeout(endSession, Math.max(0, sessionExpiry.getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [sessionExpiry, endSession]);
  if (!activeChildId || !sessionExpiry || sessionExpiry.getTime() <= Date.now()) return <Redirect href="/profiles" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarInactiveTintColor: colors.ink400,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarActiveTintColor: TAB_COLORS.home,
          tabBarIcon: ({ focused }) => (
            <ChildTabIcon
              emoji="⭐"
              focused={focused}
              activeColor={TAB_COLORS.home}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Quests',
          tabBarActiveTintColor: TAB_COLORS.tasks,
          tabBarIcon: ({ focused }) => (
            <ChildTabIcon
              emoji="📜"
              focused={focused}
              activeColor={TAB_COLORS.tasks}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarActiveTintColor: TAB_COLORS.rewards,
          tabBarIcon: ({ focused }) => (
            <ChildTabIcon
              emoji="🎁"
              focused={focused}
              activeColor={TAB_COLORS.rewards}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarActiveTintColor: TAB_COLORS.profile,
          tabBarIcon: ({ focused }) => (
            <ChildTabIcon
              emoji="😊"
              focused={focused}
              activeColor={TAB_COLORS.profile}
            />
          ),
        }}
      />
      {/* Hidden routes — navigable via router.push() but not shown in tab bar */}
      <Tabs.Screen
        name="leaderboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="requests"
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
  iconContainer: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
  iconActive: {
    fontSize: 32,
  },
});
