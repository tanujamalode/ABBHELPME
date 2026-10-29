import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Capy } from '@/components/Capy';
import { Badge, Button, Header, Row, RowGroup, Screen, Text } from '@/components/ui';
import { colors, radius, shadow, space } from '@/constants/brand';
import { outfitForRole } from '@/lib/capy';
import { MoodIcon } from '@/components/MoodIcon';
import { MOOD_LABEL, periodStats } from '@/lib/moodStats';
import { authorLine, roleLabel } from '@/lib/profileOptions';
import { confirmDeleteAccount, confirmSignOut } from '@/components/accountActions';
import { attempt } from '@/lib/attempt';
import { syncReminders } from '@/lib/reminders';
import { verifiedLabel } from '@/data/auth';
import { useApp } from '@/state/AppProvider';
import { useContribution } from '@/state/useContribution';
import { useData } from '@/state/useData';

/** My Profile: who you are, your numbers, and the settings menu. Opened from the avatar on Home. */
export default function MyProfile() {
  const { profile, account, repo, bump, updateProfile, signOut, deleteAccount } = useApp();
  const { data: contrib } = useContribution();
  const { data: stats } = useData(async (r) => {
    const [posts, moods, saved, prefs] = await Promise.all([r.listPosts(), r.listMoodCheckins(), r.listBookmarks(), r.getNotificationPrefs()]);
    return { mine: posts.filter((p) => p.mine).length, moods, saved: saved.length, prefs };
  });
  const week = stats ? periodStats(stats.moods, 7) : null;
  const name = profile?.displayName && profile.displayName !== 'there' ? profile.displayName : 'Your profile';
  const line = profile ? authorLine({ role: profile.role, experience: profile.experience, verified: profile.verified }) : null;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const setPref = async (patch: Partial<NonNullable<typeof stats>['prefs']>) => {
    if (!stats) return;
    const next = { ...stats.prefs, ...patch };
    const saved = await attempt(async () => { await repo.setNotificationPrefs(next); bump(); return true; });
    if (saved) void syncReminders(next);
  };


  return (
    <Screen>
      <Header title="My Profile" back />

      {/* Identity card */}
      <View style={styles.card}>
        <View style={styles.capyPlate} accessible accessibilityLabel="Your Cappy">
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

      <Text variant="h2" accessibilityRole="header" style={{ marginVertical: space.md }}>Settings</Text>

      <RowGroup title="Account">
        {account?.email
          ? <Row icon="mail-outline" accent="blue" title="Signed in as" subtitle={account.email} onPress={() => router.push('/profile')} />
          : null}
        <Row icon="person-outline" accent="slate" title="Role & experience" subtitle={line ?? 'Not set'} onPress={() => router.push('/profile')} />
        <Row icon="options-outline" accent="rose" title="Your categories" subtitle="Choose what you follow" onPress={() => router.push('/topics')} />
      </RowGroup>

      <RowGroup title="Security & privacy">
        <Row icon="finger-print-outline" accent="green" title="App lock" subtitle="Unlock with fingerprint, face or screen lock"
          onPress={() => { void attempt(() => updateProfile({ lockEnabled: !profile?.lockEnabled })); }}
          right={<Switch value={!!profile?.lockEnabled} onValueChange={(v) => { void attempt(() => updateProfile({ lockEnabled: v })); }} accessibilityLabel="App lock"
            trackColor={{ true: colors.red, false: colors.border }} />} />
        <Row icon="shield-checkmark-outline" accent="teal" title="Privacy & data" subtitle="How your data is stored" onPress={() => router.push('/privacy')} />
      </RowGroup>

      <RowGroup title="Notifications">
        <Row icon="alarm-outline" accent="amber" title="Gentle check-in reminder" subtitle="A once-a-day nudge"
          onPress={() => setPref({ dailyReminder: !stats?.prefs.dailyReminder })}
          right={<Switch value={!!stats?.prefs.dailyReminder} onValueChange={(v) => setPref({ dailyReminder: v })} accessibilityLabel="Gentle check-in reminder"
            trackColor={{ true: colors.red, false: colors.border }} />} />
        <Row icon="notifications-outline" accent="blue" title="All notification settings" subtitle="Reminders and your inbox" onPress={() => router.push('/notifications')} />
      </RowGroup>

      <RowGroup title="Connect">
        <Row icon="chatbubbles-outline" accent="blue" title="Messages" subtitle="Your private conversations" onPress={() => router.push('/messages')} />
        <Row icon="people-circle-outline" accent="violet" title="People who understand" subtitle="Find a peer, or let others find you" onPress={() => router.push('/people')} />
        <Row icon="planet-outline" accent="teal" title="Communities" subtitle="Follow what matters to you" onPress={() => router.push('/communities')} />
        <Row icon="ribbon-outline" accent="rose" title="Recognition" subtitle="Give and receive shout-outs" onPress={() => router.push('/recognition')} />
        <Row icon="megaphone-outline" accent="blue" title="Feedback to ABB" subtitle="Anonymous, with a monthly report" onPress={() => router.push('/feedback')} />
      </RowGroup>

      <RowGroup title="Recharge">
        <Row icon="leaf-outline" accent="green" title="Meditate & breathe" subtitle="1 to 10 minute sessions and sounds" onPress={() => router.push('/meditate')} />
        <Row icon="timer-outline" accent="amber" title="Micro-breaks" subtitle="Eyes, stretching, movement, water" onPress={() => router.push('/microbreaks')} />
        <Row icon="footsteps-outline" accent="slate" title="My Wellbeing Journey" subtitle="Check-ins, sessions, saves and more" onPress={() => router.push('/journey')} />
      </RowGroup>

      <RowGroup title="Your activity">
        <Row icon="document-text-outline" accent="blue" title="My posts" subtitle="View and manage your entries" onPress={() => router.push('/my-posts')} />
        <Row icon="bookmark-outline" accent="amber" title="My Saves" subtitle="Posts, resources, sessions and conversations" onPress={() => router.push('/saved')} />
        <Row icon="pulse-outline" accent="green" title="Mood trends" subtitle="Your week and month" onPress={() => router.push('/mood')} />
        <Row icon="stats-chart-outline" accent="violet" title="Monthly insights" subtitle="Your recap and community trends" onPress={() => router.push('/insights')} />
      </RowGroup>

      <RowGroup title="Support">
        <Row icon="help-circle-outline" accent="slate" title="Help & support" subtitle="What this app is and isn't" onPress={() => router.push('/help')} />
      </RowGroup>

      <View style={{ gap: space.md, marginTop: space.sm }}>
        <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={() => confirmSignOut(signOut)} />
        <Button label="Delete account and data" variant="danger" icon="trash-outline"
          onPress={() => confirmDeleteAccount(deleteAccount)} />
      </View>
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
