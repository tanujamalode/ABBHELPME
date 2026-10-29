import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Capy } from '@/components/Capy';
import { Badge, Button, Header, Notice, Row, RowGroup, Screen, Text } from '@/components/ui';
import { colors, radius, shadow, space } from '@/constants/brand';
import { DEMO_MODE } from '@/constants/demo';
import { outfitForRole } from '@/lib/capy';
import { MoodIcon } from '@/components/MoodIcon';
import { MOOD_LABEL, periodStats } from '@/lib/moodStats';
import { authorLine, roleLabel } from '@/lib/profileOptions';
import { confirmDeleteData, confirmSignOut } from '@/components/accountActions';
import { verifiedLabel } from '@/data/auth';
import { useApp } from '@/state/AppProvider';
import { useContribution } from '@/state/useContribution';
import { useData } from '@/state/useData';

/** My Profile: who you are, your numbers, and the settings menu. Opened from the avatar on Home. */
export default function MyProfile() {
  const { profile, account, cloud, repo, bump, updateProfile, signOut, deleteAllLocalData } = useApp();
  const { data: contrib } = useContribution();
  const { data: stats } = useData(async (r) => {
    const [posts, moods, saved, prefs] = await Promise.all([r.listPosts(), r.listMoodCheckins(), r.listBookmarks(), r.getNotificationPrefs()]);
    return { mine: posts.filter((p) => !p.sample).length, moods, saved: saved.length, prefs };
  });
  const week = stats ? periodStats(stats.moods, 7) : null;
  const name = profile?.displayName && profile.displayName !== 'there' ? profile.displayName : 'Your profile';
  const line = profile ? authorLine({ role: profile.role, experience: profile.experience, verified: profile.verified }) : null;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const setPref = async (patch: Partial<NonNullable<typeof stats>['prefs']>) => {
    if (!stats) return;
    await repo.setNotificationPrefs({ ...stats.prefs, ...patch }); bump();
  };


  return (
    <Screen>
      <Header title="My Profile" back />

      {/* Identity card */}
      <View style={styles.card}>
        <View style={styles.capyPlate} accessible accessibilityLabel="Your Capy">
          <Capy pose={outfitForRole(profile?.role)} size={78} motion="none" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h2" style={{ color: '#fff' }} numberOfLines={1}>{name}</Text>
          <Text variant="small" style={{ color: '#C9D1E2' }}>{line ?? (profile?.role ? roleLabel(profile.role) : 'Role not set')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {profile?.verified ? <Badge label={verifiedLabel()} tone="ok" /> : null}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit role and experience" onPress={() => router.push('/profile')} hitSlop={8}
          style={styles.editBtn}>
          <Text variant="label" style={{ color: '#fff' }}>EDIT</Text>
        </Pressable>
      </View>

      {/* Your numbers */}
      <View style={styles.statsRow}>
        <Stat label="CONTRIBUTION" value={String(contrib?.score ?? 0)} sub={contrib?.tier.label ?? 'Newcomer'} onPress={() => router.push('/contribution')} />
        <Stat label="THIS WEEK" value={week?.averageMood ? MOOD_LABEL[week.averageMood] : '—'}
          icon={week?.averageMood ? <MoodIcon mood={week.averageMood} size={34} /> : undefined}
          sub={week?.averageMood ? `${MOOD_LABEL[week.averageMood]} · ${week.checkinDays}/7` : 'No check-ins'} onPress={() => router.push('/mood')} />
        <Stat label="MY POSTS" value={String(stats?.mine ?? 0)} sub={`${stats?.saved ?? 0} saved`} onPress={() => router.push('/my-posts')} />
      </View>
      {DEMO_MODE ? <Notice tone="warn" icon="flask-outline" text="Prototype: your history, votes and some of these numbers are sample data." /> : null}

      <Text variant="h2" accessibilityRole="header" style={{ marginVertical: space.md }}>Settings</Text>

      <RowGroup title="Account">
        {account?.email && cloud
          ? <Row icon="mail-outline" accent="blue" title="Signed in as" subtitle={account.email} onPress={() => router.push('/profile')} />
          : null}
        <Row icon="person-outline" accent="slate" title="Role & experience" subtitle={line ?? 'Not set'} onPress={() => router.push('/profile')} />
        <Row icon="options-outline" accent="rose" title="Topic preferences" subtitle="Choose what you follow" onPress={() => router.push('/topics')} />
      </RowGroup>

      <RowGroup title="Security & privacy">
        <Row icon="finger-print-outline" accent="green" title="App lock" subtitle="Unlock with fingerprint, face or screen lock"
          onPress={() => updateProfile({ lockEnabled: !profile?.lockEnabled })}
          right={<Switch value={!!profile?.lockEnabled} onValueChange={(v) => updateProfile({ lockEnabled: v })} accessibilityLabel="App lock"
            trackColor={{ true: colors.red, false: colors.border }} />} />
        <Row icon="shield-checkmark-outline" accent="teal" title="Privacy & local storage" subtitle="How your data is stored" onPress={() => router.push('/privacy')} />
      </RowGroup>

      <RowGroup title="Notifications">
        <Row icon="alarm-outline" accent="amber" title="Gentle check-in reminder" subtitle="A once-a-day nudge"
          onPress={() => setPref({ dailyReminder: !stats?.prefs.dailyReminder })}
          right={<Switch value={!!stats?.prefs.dailyReminder} onValueChange={(v) => setPref({ dailyReminder: v })} accessibilityLabel="Gentle check-in reminder"
            trackColor={{ true: colors.red, false: colors.border }} />} />
        <Row icon="notifications-outline" accent="blue" title="All notification settings" subtitle="Reminders and your inbox" onPress={() => router.push('/notifications')} />
      </RowGroup>

      <RowGroup title="Your activity">
        <Row icon="document-text-outline" accent="blue" title="My posts" subtitle="View and manage your entries" onPress={() => router.push('/my-posts')} />
        <Row icon="bookmark-outline" accent="amber" title="Saved" subtitle="Bookmarks and saved resources" onPress={() => router.push('/saved')} />
        <Row icon="pulse-outline" accent="green" title="Mood trends" subtitle="Your week and month" onPress={() => router.push('/mood')} />
        <Row icon="stats-chart-outline" accent="violet" title="Monthly insights" subtitle="Personal recap on this device" onPress={() => router.push('/insights')} />
      </RowGroup>

      <RowGroup title="Support">
        <Row icon="help-circle-outline" accent="slate" title="Help & support" subtitle="What this app is and isn't" onPress={() => router.push('/help')} />
      </RowGroup>

      <View style={{ gap: space.md, marginTop: space.sm }}>
        <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={() => confirmSignOut(cloud, signOut)} />
        <Button label={cloud ? 'Delete account and data' : 'Delete local data'} variant="danger" icon="trash-outline"
          onPress={() => confirmDeleteData(cloud, deleteAllLocalData)} />
      </View>
      <Notice text="Uninstalling the app, losing this device, or clearing its data can permanently remove everything saved here." icon="warning-outline" tone="warn" />
      <Text variant="small" style={{ textAlign: 'center', marginTop: space.md }}>ABB Help Me · version {version}</Text>
    </Screen>
  );
}

function Stat({ label, value, sub, onPress, icon }: { label: string; value: string; sub: string; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label.toLowerCase()}: ${value}, ${sub}`} onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.85 }]}>
      <Text variant="label">{label}</Text>
      {icon ? <View style={{ height: 34, marginTop: 2, justifyContent: 'center' }}>{icon}</View>
        : <Text style={{ fontSize: 26, lineHeight: 34, fontWeight: '800', color: colors.navy, marginTop: 2 }}>{value}</Text>}
      <Text variant="small" numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.navy,
    marginBottom: space.md, ...shadow },
  capyPlate: { width: 84, height: 92, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  editBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: '#ffffff55' },
  statsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  stat: { flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#EEF0F5', ...shadow },
});
