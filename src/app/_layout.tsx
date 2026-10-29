import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '@/state/AppProvider';
import { Button, EmptyState, Loading, Screen } from '@/components/ui';

/**
 * Navigation follows auth state. Signed out, locked, or mid-registration → welcome.
 * Signed in without topics → onboarding. Otherwise the app. A session that ends anywhere
 * (sign-out, expired refresh token, account deleted) sends the user back to welcome.
 */
function Gate() {
  const { status, error, retry, profile, unlocked } = useApp();
  if (status === 'loading') return <Screen scroll={false}><Loading label="Getting things ready…" /></Screen>;
  if (status === 'unconfigured') {
    return (
      <Screen scroll={false}>
        <EmptyState capy="concerned" title="Backend not configured"
          text="Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the .env file (see .env.example), then restart with: npx expo start -c" />
      </Screen>
    );
  }
  if (status === 'error') {
    return (
      <Screen scroll={false}>
        <EmptyState capy="concerned" title="Can't reach the server" text={error ?? undefined}
          action={<Button label="Try again" onPress={retry} />} />
      </Screen>
    );
  }
  const onboarded = !!profile?.onboardingComplete;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAF8F6' } }}>
      {/* Not signed in or locked: welcome (email code sign-in, profile setup, unlock) */}
      <Stack.Protected guard={!unlocked}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      {/* First launch: choose at least three topics */}
      <Stack.Protected guard={unlocked && !onboarded}>
        <Stack.Screen name="onboarding/topics" />
      </Stack.Protected>
      {/* Main app */}
      <Stack.Protected guard={unlocked && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
        <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="resource/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="insights" />
        <Stack.Screen name="mood" />
        <Stack.Screen name="contribution" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="my-posts" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="topics" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="more" />
        <Stack.Screen name="help" />
        <Stack.Screen name="communities/index" />
        <Stack.Screen name="communities/[id]" />
        <Stack.Screen name="people" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="meditate" options={{ gestureEnabled: false }} />
        <Stack.Screen name="microbreaks" />
        <Stack.Screen name="microbreak/[id]" />
        <Stack.Screen name="journey" />
        <Stack.Screen name="recognition" />
        <Stack.Screen name="feedback" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider>
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
