import { Pressable, StyleSheet, type ColorValue } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Capy } from '@/components/Capy';
import { Text } from '@/components/ui';
import { colors } from '@/constants/brand';

type Name = React.ComponentProps<typeof Ionicons>['name'];
const tab = (title: string, on: Name, off: Name) => ({
  title,
  tabBarAccessibilityLabel: `${title} tab`,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? on : off} size={23} color={color as string} />
  ),
});

/** Centre of the tab bar: Capy peeking over the bar's top edge. Opens the assistant over the tabs. */
function AssistantButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Ask Capy, the help assistant" onPress={() => router.push('/assistant')}
      style={({ pressed }) => [styles.centerSlot, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Capy pose="headphones" size={66} style={styles.peek} />
      <Text style={styles.fabLabel}>Ask Capy</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen name="index" options={tab('Home', 'home', 'home-outline')} />
      <Tabs.Screen name="community" options={tab('Community', 'people', 'people-outline')} />
      <Tabs.Screen name="ask" options={{ title: 'Ask', tabBarButton: () => <AssistantButton /> }} />
      <Tabs.Screen name="resources" options={tab('Resources', 'library', 'library-outline')} />
      <Tabs.Screen name="wellbeing" options={tab('Well-being', 'leaf', 'leaf-outline')} />
      {/* Profile & settings: opened from the avatar on Home, not a tab of its own. */}
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface, borderTopWidth: 0, minHeight: 64, paddingTop: 6,
    shadowColor: '#0F1B33', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  centerSlot: { flex: 1, alignItems: 'center' },
  // Capy rises ~38pt above the bar, so only head and shoulders show over the edge.
  peek: { marginTop: -38 },
  fabLabel: { fontSize: 11, fontWeight: '700', color: colors.red, marginTop: -2 },
});
