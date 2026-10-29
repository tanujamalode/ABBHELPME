import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CapySays } from '@/components/Capy';
import { MoodChart } from '@/components/MoodChart';
import { Button, Card, Chip, Header, Loading, Notice, Row, RowGroup, Screen, Text } from '@/components/ui';
import { accents, colors, radius, space, type Accent } from '@/constants/brand';
import { MOOD_TAGS, type Mood, type MoodTag } from '@/data/types';
import { MOOD_REACTION } from '@/lib/capy';
import { MOOD_ACCENT, MOOD_ICON, MOOD_LABEL, TAG_LABEL, periodStats } from '@/lib/moodStats';
import { GROUP_META } from '@/lib/resourceMeta';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const MOODS: { id: Mood; label: string; accent: Accent }[] = (['great', 'okay', 'not_great', 'struggling'] as const)
  .map((id) => ({ id, label: MOOD_LABEL[id], accent: MOOD_ACCENT[id] }));

export default function Wellbeing() {
  const { repo, bump } = useApp();
  const [mood, setMood] = useState<Mood | null>(null);
  const [tags, setTags] = useState<MoodTag[]>([]);
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data, loading } = useData((r) => r.listResources());
  const { data: moods } = useData((r) => r.listMoodCheckins());
  const week = moods ? periodStats(moods, 7) : null;
  const toggleTag = (t: MoodTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const picks = (data ?? []).filter((r) => ['r-stress', 'r-mindful', 'r-balance', 'r-eap', 'r-urgent'].includes(r.id));

  const save = async () => {
    if (!mood) return;
    setBusy(true); setErr(null);
    try { await repo.addMoodCheckin(mood, tags); bump(); setSaved(true); setTags([]); }
    catch { setErr('Could not save. Check your internet connection and try again.'); }
    setBusy(false);
  };

  return (
    <Screen>
      <Header title="Well-being" subtitle="Small steps. A healthier you." />
      {!dismissed ? (
        <Card style={{ marginBottom: space.lg }}>
          {saved && mood ? (
            <View>
              <CapySays pose={MOOD_REACTION[mood].saved.pose} message={MOOD_REACTION[mood].saved.text} size={104} motion="pop" tint={colors.bg} />
              {mood === 'struggling' || mood === 'not_great' ? (
                <Button label="See support options" icon="heart-outline" variant="secondary" style={{ marginTop: space.md }}
                  onPress={() => router.push({ pathname: '/resource/[id]', params: { id: 'r-eap' } })} />
              ) : null}
              <Button label="Check in again later" variant="ghost" onPress={() => { setSaved(false); setMood(null); }} />
            </View>
          ) : (
            <>
              <CapySays pose={mood ? MOOD_REACTION[mood].pick.pose : 'hi'} size={88} motion="pop" tint={colors.bg}
                message={mood ? MOOD_REACTION[mood].pick.text : 'How are you feeling today? (optional)'} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: space.md }}>
                {MOODS.map((m) => {
                  const on = mood === m.id;
                  return (
                    <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: on }}
                      onPress={() => setMood(m.id)} style={{ alignItems: 'center', minWidth: 70, minHeight: 72, gap: 6 }}>
                      <View style={{ width: 58, height: 58, borderRadius: radius.lg, backgroundColor: accents[m.accent].bg, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2.5, borderColor: on ? accents[m.accent].fg : 'transparent' }}>
                        <Ionicons name={MOOD_ICON[m.id]} size={30} color={accents[m.accent].fg} />
                      </View>
                      <Text variant="small" style={{ color: colors.navy, fontWeight: on ? '700' : '500' }}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {mood ? (
                <View style={{ marginBottom: space.md }}>
                  <Text variant="small" style={{ marginBottom: space.sm }}>What&apos;s shaping today? (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                    {MOOD_TAGS.map((t) => <Chip key={t} label={TAG_LABEL[t]} selected={tags.includes(t)} onPress={() => toggleTag(t)} />)}
                  </ScrollView>
                </View>
              ) : null}
              {err ? <Text variant="small" style={{ color: colors.redDark }}>{err}</Text> : null}
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Button label="Save check-in" onPress={save} disabled={!mood} loading={busy} style={{ flex: 1 }} />
                <Button label="Skip" variant="ghost" onPress={() => setDismissed(true)} />
              </View>
            </>
          )}
        </Card>
      ) : null}
      <Notice icon="eye-off-outline" text="Only you can see your check-ins. They are not monitored and don't trigger any support or alert. This app is not monitored in real time." />

      {week && moods && moods.length ? (
        <Card style={{ marginTop: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
            <Text variant="h3" style={{ flex: 1 }}>Your week</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Open mood trends" onPress={() => router.push('/mood')} hitSlop={10}>
              <Text variant="small" style={{ color: colors.red, fontWeight: '700' }}>Trends →</Text>
            </Pressable>
          </View>
          <Text variant="small" style={{ marginBottom: space.md }}>
            {week.averageMood ? `Mostly ${MOOD_LABEL[week.averageMood].toLowerCase()}` : 'No check-ins'} · {week.checkinDays} of 7 days
          </Text>
          <MoodChart days={week.days} />
        </Card>
      ) : null}

      <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.lg, marginBottom: space.sm }}>Explore resources</Text>
      {loading ? <Loading /> : (
        <RowGroup>
          {picks.map((r) => (
            <Row key={r.id} icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} title={r.title} subtitle={r.subtitle}
              onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })} />
          ))}
        </RowGroup>
      )}
      <View style={{ marginTop: space.lg }}>
        <Button label="All resources" variant="secondary" onPress={() => router.push('/resources')} />
      </View>
    </Screen>
  );
}
