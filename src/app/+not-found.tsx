import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';

/** Unknown links (old deep links, deleted posts' URLs) land here instead of a blank screen. */
export default function NotFound() {
  return (
    <Screen scroll={false}>
      <EmptyState capy="surprised" title="This page doesn't exist" text="The link may be old or the item was removed."
        action={<Button label="Go home" onPress={() => router.replace('/')} />} />
    </Screen>
  );
}
