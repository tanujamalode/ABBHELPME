import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CapySays } from '@/components/Capy';
import { AuthorTag } from '@/components/community';
import { Select } from '@/components/Select';
import { Badge, Button, Card, Field, Header, Notice, Screen, Text } from '@/components/ui';
import { space } from '@/constants/brand';
import { outfitForRole } from '@/lib/capy';
import { EXPERIENCE_OPTIONS, ROLE_OPTIONS } from '@/lib/profileOptions';
import { verifiedLabel, verifier } from '@/data/auth';
import { useApp } from '@/state/AppProvider';

export default function EditProfile() {
  const { profile, account, updateProfile } = useApp();
  const [name, setName] = useState(profile?.displayName === 'there' ? '' : profile?.displayName ?? '');
  const [role, setRole] = useState<string | null>(profile?.role ?? null);
  const [experience, setExperience] = useState<string | null>(profile?.experience ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (name.trim().length > 30) { setErr('Please keep your name within 30 characters.'); return; }
    setBusy(true); setErr(null);
    try { await updateProfile({ displayName: name.trim() || 'there', role, experience }); router.back(); }
    catch { setErr('Could not save on this device. Please try again.'); setBusy(false); }
  };

  return (
    <Screen>
      <Header title="Role & experience" back />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
        <Badge label={profile?.verified ? verifiedLabel() : 'Not verified'} tone={profile?.verified ? 'ok' : 'warn'} />
        <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>
          {verifier.isDemo ? 'Verification is simulated in this prototype.' : account?.email ? `Signed in as ${account.email}` : null}
        </Text>
      </View>
      <View style={{ marginBottom: space.lg }}>
        <CapySays pose={outfitForRole(role)} message="I dress for your role. Change it and see!" size={110} motion="pop" />
      </View>
      <Field label="Display name (only you see this)" value={name} onChangeText={setName} placeholder="First name or nickname" maxLength={40} error={err} />
      <Select label="Your role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      <Select label="Experience at ABB" value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} />

      <Card style={{ marginBottom: space.lg }}>
        <Text variant="label" style={{ marginBottom: space.sm }}>HOW OTHERS SEE YOUR POSTS (WHEN YOU CHOOSE TO SHOW IT)</Text>
        <AuthorTag author={{ role, experience, verified: !!profile?.verified }} />
      </Card>
      <Notice text="Changes apply to new posts. Posts you already wrote keep what was shown at the time." />
      <Notice icon="shield-checkmark-outline" text="Role bands are deliberately broad so they don't single anyone out. Choose “Other / Prefer not to say” if your role is rare in your team." />
      <Button label="Save" onPress={save} loading={busy} style={{ marginTop: space.lg }} />
    </Screen>
  );
}
