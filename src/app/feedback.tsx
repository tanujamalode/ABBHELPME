import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Header, IconButton, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { colors, space } from '@/constants/brand';
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/data/types';
import { attempt } from '@/lib/attempt';
import { confirmContent } from '@/lib/confirmContent';
import { FEEDBACK_META, changeNote, monthTitle, shiftMonth } from '@/lib/recognition';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

type Tab = 'send' | 'report';
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/**
 * Anonymous feedback to ABB. The feedback is stored without your account, so it cannot be traced back to you.
 * Colleagues see only monthly counts per category, and only for categories with at least three submissions.
 */
export default function Feedback() {
  const { repo } = useApp();
  const [tab, setTab] = useState<Tab>('send');
  const [category, setCategory] = useState<FeedbackCategory>('workplace');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const thisMonth = startOfMonth(new Date());
  const { data, loading, error, reload } = useData((r) => r.getFeedbackReport(month), [month.getTime()]);

  const send = () => { if (body.trim()) confirmContent(body, () => { void deliver(); }); };

  const deliver = async () => {
    setBusy(true);
    const ok = await attempt(async () => { await repo.submitFeedback(category, body.trim()); return true; }, 'send your feedback');
    setBusy(false);
    if (ok) { setBody(''); Alert.alert('Thank you', 'Your feedback was sent anonymously. It adds to the monthly report once enough colleagues share on the same topic.'); reload(); }
  };

  return (
    <Screen>
      <Header title="Feedback to ABB" back subtitle="Anonymous. Honest. Helps make work better." />
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Chip label="Share feedback" selected={tab === 'send'} onPress={() => setTab('send')} />
        <Chip label="Monthly report" selected={tab === 'report'} onPress={() => setTab('report')} />
      </View>

      {tab === 'send' ? (
        <>
          <Text variant="h3" style={{ marginBottom: space.sm }}>Topic</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
            {FEEDBACK_CATEGORIES.map((c) => <Chip key={c} label={FEEDBACK_META[c].label} selected={category === c} onPress={() => setCategory(c)} />)}
          </View>
          <Field label="Your feedback" value={body} onChangeText={setBody} multiline maxLength={1000}
            placeholder="What is working well, and what could be better?" hint={`${body.length}/1000`} />
          <Button label="Send anonymously" icon="paper-plane-outline" onPress={send} loading={busy} disabled={!body.trim()} />
          <Notice icon="eye-off-outline" text="Your name, email and account are not saved with your feedback. A separate counter limits you to 3 a day to prevent spam, and it holds no feedback text. Do not include names or private details." />
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
            <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth((m) => shiftMonth(m, -1))} />
            <Text variant="h2" accessibilityLiveRegion="polite">{monthTitle(month)}</Text>
            <IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth((m) => (m < thisMonth ? shiftMonth(m, 1) : m))}
              color={month >= thisMonth ? colors.border : colors.navy} />
          </View>
          {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : !data?.length ? (
            <EmptyState capy="calm" title="Not enough feedback yet" text="A topic appears here once at least three colleagues have shared on it." />
          ) : (
            <>
              {(() => {
                const max = Math.max(1, ...data.map((r) => r.count));
                return data.map((r) => (
                  <Card key={r.category} style={{ marginBottom: space.sm }} accessibilityLabel={`${FEEDBACK_META[r.category].label}, ${r.count} submissions`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <IconTile icon={FEEDBACK_META[r.category].icon} accent="blue" size={40} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="h3">{FEEDBACK_META[r.category].label}</Text>
                          <Text variant="h3">{r.count}</Text>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sand, marginTop: 6 }}>
                          <View style={{ height: 8, borderRadius: 4, width: `${(r.count / max) * 100}%`, backgroundColor: colors.red }} />
                        </View>
                        {changeNote(r.count, r.previous) ? <Text variant="small" style={{ marginTop: 4 }}>{changeNote(r.count, r.previous)}</Text> : null}
                      </View>
                    </View>
                  </Card>
                ));
              })()}
            </>
          )}
          <Notice text="Counts only. Topics with fewer than three submissions are hidden so no one can be picked out." icon="shield-checkmark-outline" />
        </>
      )}
    </Screen>
  );
}
