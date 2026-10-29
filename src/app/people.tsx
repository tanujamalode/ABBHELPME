import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Header, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { colors, space } from '@/constants/brand';
import type { PersonMatch } from '@/data/types';
import { attempt } from '@/lib/attempt';
import { confirmContent } from '@/lib/confirmContent';
import { experienceLabel, roleLabel } from '@/lib/profileOptions';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

/**
 * People who understand: colleagues with a similar role, experience or interests who chose to be found.
 * Everyone appears under a made-up name; you only see their role and experience band. Nobody is matched
 * without choosing it, and nobody can message you until you accept.
 */
export default function People() {
  const { repo, bump, profile, updateProfile } = useApp();
  const { data, loading, error, reload } = useData((r) => r.discoverPeople());
  const [target, setTarget] = useState<PersonMatch | null>(null);
  const [intro, setIntro] = useState('');
  const [showRole, setShowRole] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = () => { if (target && intro.trim()) confirmContent(intro, () => { void deliver(); }); };

  const deliver = async () => {
    if (!target) return;
    setBusy(true);
    const id = await attempt(() => repo.requestChat(target.code, intro, showRole), 'send your request');
    setBusy(false);
    if (id) {
      setTarget(null); setIntro(''); bump(); reload();
      Alert.alert('Request sent', 'They will see your note under a made-up name. You can chat once they accept.', [
        { text: 'Open messages', onPress: () => router.replace('/messages') }, { text: 'OK' },
      ]);
    }
  };

  const meta = (p: PersonMatch) => [roleLabel(p.role), experienceLabel(p.experience)].filter(Boolean).join(' · ') || 'Role not shared';

  return (
    <Screen>
      <Header title="People who understand" back subtitle="Talk privately with a colleague who has been there."
        />
      <Card style={{ marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="h3">Let colleagues find me</Text>
            <Text variant="small">Others see a made-up name plus your role and experience band. Never your name or email.</Text>
          </View>
          <Switch value={!!profile?.discoverable} accessibilityLabel="Let colleagues find me"
            onValueChange={(v) => { void attempt(() => updateProfile({ discoverable: v }), 'save that').then(reload); }}
            trackColor={{ true: colors.red, false: colors.border }} />
        </View>
      </Card>
      <Button label="My messages" variant="secondary" icon="chatbubbles-outline" onPress={() => router.push('/messages')} />

      <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.lg, marginBottom: space.sm }}>Suggested for you</Text>
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState capy="thinking" title="No one to suggest yet"
          text="Colleagues appear here once they choose to be found. Turn on the switch above to help others find you too." />
      ) : data.map((p) => (
        <Card key={p.code} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <IconTile icon="person-outline" accent="violet" size={44} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{p.alias}</Text>
              <Text variant="small">{meta(p)}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {p.role && p.role === profile?.role ? <Badge label="Same role" tone="ok" /> : null}
                {p.experience && p.experience === profile?.experience ? <Badge label="Similar experience" tone="ok" /> : null}
                {p.sharedTopics ? <Badge label={`${p.sharedTopics} shared ${p.sharedTopics === 1 ? 'interest' : 'interests'}`} tone="neutral" /> : null}
              </View>
            </View>
          </View>
          {target?.code === p.code ? (
            <View style={{ marginTop: space.md }}>
              <Field label="Say hello" value={intro} onChangeText={setIntro} multiline maxLength={500}
                placeholder="A line about why you would like to talk" hint={`${intro.length}/500 · they see this before deciding`} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Text variant="h3" style={{ fontSize: 14 }}>Show my role & experience</Text>
                  <Text variant="small">Off: you stay fully anonymous.</Text>
                </View>
                <Switch value={showRole} onValueChange={setShowRole} accessibilityLabel="Show my role and experience"
                  trackColor={{ true: colors.red, false: colors.border }} />
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><Button label="Cancel" variant="ghost" onPress={() => setTarget(null)} /></View>
                <View style={{ flex: 1 }}><Button label="Send request" onPress={send} loading={busy} disabled={!intro.trim()} /></View>
              </View>
            </View>
          ) : (
            <Button label="Say hello" icon="chatbubble-outline" variant="secondary" onPress={() => { setTarget(p); setIntro(''); }} style={{ marginTop: space.md }} />
          )}
        </Card>
      ))}
      <Notice icon="shield-checkmark-outline"
        text="You can decline, mute, block, report or leave any conversation at any time. This is peer support, not professional help. For that, see Resources." />
    </Screen>
  );
}
