import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Header, Notice, Screen, Text } from '@/components/ui';
import { space } from '@/constants/brand';

export default function Help() {
  return (
    <Screen>
      <Header title="Help & Support" back />
      <View style={{ gap: space.md }}>
        <Card>
          <Text variant="h3">What this app is</Text>
          <Text variant="body" style={{ marginTop: 4 }}>A private, supportive space to find resources, write things down and browse example questions. Everything you add stays on this device.</Text>
        </Card>
        <Card>
          <Text variant="h3">What it is not</Text>
          <Text variant="body" style={{ marginTop: 4 }}>It doesn&apos;t replace HR, IT, a qualified counselor, emergency services or formal reporting channels. It is not monitored in real time, and nobody reads what you write.</Text>
        </Card>
        <Card>
          <Text variant="h3">Need help right now?</Text>
          <Text variant="body" style={{ marginTop: 4 }}>If you or someone else is in danger, contact your local emergency services immediately. For everyday support, see the resources list.</Text>
        </Card>
      </View>
      <Notice text="Contact details for ABB support teams aren't bundled in this prototype. They'll appear on each resource once ABB provides approved ones." />
      <Button label="Browse resources" variant="secondary" onPress={() => router.push('/resources')} style={{ marginTop: space.lg }} />
    </Screen>
  );
}
