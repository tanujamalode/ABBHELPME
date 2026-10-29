import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CapyHeroCard, type HeroSlide } from '@/components/CapyHeroCard';
import { BrandMark, Card, IconButton, IconTile, Loading, Notice, Screen, Text, type IconName } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { accents, colors, radius, shadow, space, type Accent } from '@/constants/brand';
import { greeting, outfitForRole } from '@/lib/capy';
import { MOOD_LABEL, periodStats } from '@/lib/moodStats';
import { MoodIcon } from '@/components/MoodIcon';
import { useApp } from '@/state/AppProvider';
import { useContribution } from '@/state/useContribution';
import { useData } from '@/state/useData';

type Action = { label: string; hint: string; icon: IconName; accent: Accent; type: 'personal' | 'work_question'; category?: string };
const ACTIONS: Action[] = [
  { label: 'Personal Support', hint: 'Feelings & life', icon: 'heart', accent: 'rose', type: 'personal' },
  { label: 'Work Problem', hint: 'Something blocking you', icon: 'briefcase', accent: 'blue', type: 'work_question', category: 'Work Problem' },
  { label: 'Work Question', hint: 'How do I…?', icon: 'bulb', accent: 'violet', type: 'work_question', category: 'Work Question' },
  { label: 'HR Help', hint: 'Leave, pay, policy', icon: 'id-card', accent: 'green', type: 'work_question', category: 'HR' },
  { label: 'IT Help', hint: 'Access & devices', icon: 'laptop', accent: 'teal', type: 'work_question', category: 'IT' },
  { label: 'Other', hint: 'Anything else', icon: 'grid', accent: 'amber', type: 'work_question', category: 'Other' },
];

export default function Home() {
  const { profile } = useApp();
  const insets = useSafeAreaInsets();
  // White status-bar icons over the navy hero; back to dark when leaving Home.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, []));
  const { data, loading } = useData(async (repo) => {
    const [trending, ach] = await Promise.all([repo.listPosts('work_question'), repo.listPosts('achievement')]);
    return { trending: trending.slice(0, 2), achievement: ach[0] };
  });
  const { data: moods } = useData((r) => r.listMoodCheckins());
  const { data: contrib } = useContribution();
  const week = moods ? periodStats(moods, 7) : null;
  const name = profile?.displayName && profile.displayName !== 'there' ? profile.displayName : '';
  const initial = (name[0] ?? '?').toUpperCase();
  const [hour] = useState(() => new Date().getHours());
  // Today is the last day of the 7-day series.
  const todayMood = week?.days[week.days.length - 1]?.mood ?? null;
  const lowToday = todayMood === 'struggling' || todayMood === 'not_great';
  const hello = `${greeting(hour)}${name ? `, ${name}` : ''}`;

  const slides: HeroSlide[] = [
    {
      key: 'checkin', kicker: hello, pose: outfitForRole(profile?.role), capySize: 182,
      title: !todayMood ? 'How are you feeling today?' : lowToday ? "I'm here for you today." : 'Thanks for checking in today!',
      actions: !todayMood ? [
        { icon: 'happy-outline', label: 'Check in', primary: true, onPress: () => router.push('/wellbeing') },
        { icon: 'chatbubble-ellipses-outline', label: 'Ask Capy', onPress: () => router.push('/assistant') },
        { icon: 'stats-chart-outline', label: 'Mood trends', onPress: () => router.push('/mood') },
      ] : lowToday ? [
        { icon: 'heart-outline', label: 'Get support', primary: true, onPress: () => router.push('/resource/r-eap') },
        { icon: 'chatbubble-ellipses-outline', label: 'Talk to Capy', onPress: () => router.push('/assistant') },
      ] : [
        { icon: 'stats-chart-outline', label: 'See your trends', primary: true, onPress: () => router.push('/mood') },
        { icon: 'chatbubble-ellipses-outline', label: 'Ask Capy', onPress: () => router.push('/assistant') },
      ],
    },
    {
      key: 'ask', kicker: 'Your help assistant', pose: 'laptop', capySize: 168,
      title: 'Need a hand?\nAsk Capy',
      actions: [
        { icon: 'chatbubble-ellipses-outline', label: 'Ask Capy', primary: true, onPress: () => router.push('/assistant') },
        { icon: 'search-outline', label: 'Search', onPress: () => router.push('/search') },
      ],
    },
    {
      // Dark-hoodie pose: the white-hoodie cut-outs show background specks on the navy card.
      key: 'week', kicker: 'Your week', pose: 'outfit_casual', capySize: 178,
      title: week?.averageMood ? `Mostly ${MOOD_LABEL[week.averageMood].toLowerCase()}\n${week.checkinDays} of 7 days` : 'Start your week with a check-in',
      actions: [
        { icon: 'stats-chart-outline', label: 'Mood trends', primary: true, onPress: () => router.push('/mood') },
        { icon: 'leaf-outline', label: 'Well-being', onPress: () => router.push('/wellbeing') },
      ],
    },
  ];

  return (
    <Screen bleedTop>
      {/* Navy hero runs edge-to-edge from the top of the screen (left, right and under the status bar); the app bar sits inside it. */}
      <View style={styles.header}>
        <CapyHeroCard flush slides={slides} top={
          <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
            <BrandMark height={20} light />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <IconButton icon="notifications-outline" label="Notifications" color="#fff" onPress={() => router.push('/notifications')} />
              <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => router.push('/more')} hitSlop={6}
                style={styles.avatar}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{initial}</Text>
              </Pressable>
            </View>
          </View>
        } />
      </View>

      <View style={styles.body}>
      <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="Search for help, topics, or resources"
        style={({ pressed }) => [styles.search, pressed && { opacity: 0.85 }]}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <Text variant="small" style={{ fontSize: 15, flex: 1 }}>Search help, topics, resources</Text>
      </Pressable>

      <View style={styles.statsRow}>
        <Pressable accessibilityRole="button" onPress={() => router.push(moods?.length ? '/mood' : '/wellbeing')}
          accessibilityLabel={week?.averageMood ? `This week: mostly ${MOOD_LABEL[week.averageMood]}, ${week.checkinDays} check-in days. Open mood trends` : 'No check-ins this week. Check in'}
          style={({ pressed }) => [styles.stat, pressed && { opacity: 0.85 }]}>
          <View style={styles.statHead}><IconTile icon="pulse" accent="green" size={30} /><Text variant="label">THIS WEEK</Text></View>
          <View style={styles.statIcon}>{week?.averageMood ? <MoodIcon mood={week.averageMood} size={38} /> : <Text style={styles.statBig}>—</Text>}</View>
          <Text variant="small" numberOfLines={1}>
            {week?.averageMood ? `${MOOD_LABEL[week.averageMood]} · ${week.checkinDays}/7 days` : 'Tap to check in'}
          </Text>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants">
            {(week?.days ?? Array.from({ length: 7 }, (_, i) => ({ day: i, score: null }))).map((d) => (
              <View key={d.day} style={[styles.dot, d.score != null && { backgroundColor: accents.blue.fg, height: 4 + d.score * 3 }]} />
            ))}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/contribution')}
          accessibilityLabel={`Contribution: ${contrib?.score ?? 0} points, ${contrib?.tier.label ?? 'Newcomer'}`}
          style={({ pressed }) => [styles.stat, pressed && { opacity: 0.85 }]}>
          <View style={styles.statHead}><IconTile icon="trophy" accent="amber" size={30} /><Text variant="label">CONTRIBUTION</Text></View>
          <Text style={[styles.statBig, { fontWeight: '800', color: colors.navy }]}>{contrib?.score ?? 0}</Text>
          <Text variant="small" numberOfLines={1}>{contrib?.tier.label ?? 'Newcomer'}{contrib?.next ? ` · ${contrib.next.min - contrib.score} to next` : ''}</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((contrib?.progress ?? 0) * 100)}%` }]} /></View>
        </Pressable>
      </View>

      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.md }}>How can we help you today?</Text>
      <View style={styles.grid}>
        {ACTIONS.map((a) => (
          <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={`${a.label}. ${a.hint}`}
            onPress={() => router.push({ pathname: '/compose', params: { type: a.type, ...(a.category ? { category: a.category } : {}) } })}
            style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}>
            <IconTile icon={a.icon} accent={a.accent} size={46} />
            <View>
              <Text variant="h3" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={2}>{a.label}</Text>
              <Text variant="small" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>{a.hint}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Card onPress={() => router.push('/resource/r-eap')} accessibilityLabel="Need someone to talk to? See support resources"
        style={{ backgroundColor: colors.navy, borderColor: colors.navy, marginBottom: space.xs, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="h3" style={{ color: '#fff' }}>Need someone to talk to?</Text>
          <Text variant="small" style={{ color: '#C9D1E2', marginTop: space.xs }}>
            See the support options available through your Employee Assistance Program (EAP).
          </Text>
          <Text variant="h3" style={{ color: '#fff', marginTop: space.sm, fontSize: 14 }}>View support options →</Text>
        </View>
        <View style={[styles.eapIcon]}><Ionicons name="chatbubbles" size={26} color="#fff" /></View>
      </Card>
      <Notice text="This app is not monitored in real time. For urgent help, contact your local emergency services." icon="alert-circle-outline" tone="warn" />

      <View style={styles.sectionHead}>
        <Text variant="h2" accessibilityRole="header">Trending in Community</Text>
        <Text variant="h3" style={{ color: colors.red }} accessibilityRole="link" onPress={() => router.push('/community')}>View all</Text>
      </View>
      {loading ? <Loading /> : data?.trending.map((p) => <PostCard key={p.id} post={p} compact />)}

      {data?.achievement ? (
        <>
          <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.lg, marginBottom: space.md }}>Recognition</Text>
          <Card onPress={() => router.push({ pathname: '/community', params: { filter: 'achievements' } })} accessibilityLabel="Open achievements in Community">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconTile icon="trophy" accent="amber" size={48} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{data.achievement.title}</Text>
                <Text variant="small">{data.achievement.sample ? 'Sample content · ' : ''}See achievements in Community</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Card>
        </>
      ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: -space.lg, marginHorizontal: -space.lg, marginBottom: space.lg },
  body: { },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ffffff40' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: space.md, ...shadow },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm + 2, marginBottom: space.xl },
  action: { width: '31.6%', minHeight: 132, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: '#EEF0F5', justifyContent: 'space-between', ...shadow },
  eapIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: accents.rose.fg, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
  stat: { flex: 1, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#EEF0F5', ...shadow },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statIcon: { marginTop: space.sm, height: 38, justifyContent: 'center' },
  statBig: { fontSize: 30, lineHeight: 38, marginTop: space.sm },
  dots: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 18, marginTop: space.sm },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginTop: space.sm + 6 },
  fill: { height: 6, borderRadius: 3, backgroundColor: accents.amber.fg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: space.md },
});
