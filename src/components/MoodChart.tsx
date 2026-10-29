import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { accents, colors, space } from '@/constants/brand';
import { MoodIcon } from '@/components/MoodIcon';
import { MOOD_LABEL, type DayPoint } from '@/lib/moodStats';

const PLOT_H = 112;
const LEVELS = 4; // struggling(1) … great(4)
const BAR = accents.blue.fg; // single series → single hue, no legend; the axis icons carry meaning

const dayName = (t: number, style: 'narrow' | 'short') =>
  new Date(t).toLocaleDateString(undefined, style === 'narrow' ? { weekday: 'narrow' } : { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Bar per day, height = average mood that day. Tap a bar for the exact value.
 * "Table" toggle lists the same data as text for screen readers and print.
 */
export function MoodChart({ days }: { days: DayPoint[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const dense = days.length > 10;
  const selected = sel != null ? days[sel] : null;

  if (table) {
    return (
      <View>
        <TableToggle table onToggle={() => setTable(false)} />
        {days.filter((d) => d.count > 0).length === 0 ? <Text variant="small">No check-ins in this period.</Text> : null}
        {days.filter((d) => d.count > 0).map((d) => (
          <View key={d.day} style={styles.tableRow}>
            <Text variant="body" style={{ flex: 1 }}>{dayName(d.day, 'short')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MoodIcon mood={d.mood!} size={18} bare />
              <Text variant="body">{MOOD_LABEL[d.mood!]}{d.count > 1 ? ` (${d.count})` : ''}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 22, marginBottom: space.sm }}>
        <Text variant="small" style={{ flex: 1, color: colors.navy2 }} accessibilityLiveRegion="polite">
          {selected ? (selected.mood ? `${dayName(selected.day, 'short')} · ${MOOD_LABEL[selected.mood]}` +
            `${selected.count > 1 ? ` · ${selected.count} check-ins` : ''}` : `${dayName(selected.day, 'short')} · no check-in`)
            : 'Tap a bar for details'}
        </Text>
        <TableToggle table={false} onToggle={() => setTable(true)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {/* y labels: weather icon at each level, recessive */}
        <View style={{ height: PLOT_H, justifyContent: 'space-between', marginRight: 6 }} importantForAccessibility="no-hide-descendants">
          {(['great', 'okay', 'not_great', 'struggling'] as const).map((m) => <MoodIcon key={m} mood={m} size={14} bare />)}
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.plot, { height: PLOT_H }]}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.grid, { top: 7 + (i * (PLOT_H - 14)) / 3 }]} />)}
            {days.map((d, i) => {
              const h = d.score == null ? 0 : Math.max(6, ((d.score - 0.5) / LEVELS) * PLOT_H);
              const on = sel === i;
              return (
                <Pressable key={d.day} onPress={() => setSel(on ? null : i)} style={styles.hit}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayName(d.day, 'short')}: ${d.mood ? MOOD_LABEL[d.mood] : 'no check-in'}`}>
                  {d.score == null ? <View style={styles.empty} /> : (
                    <View style={[styles.bar, { height: h, width: dense ? 6 : 18, opacity: sel == null || on ? 1 : 0.35 }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4 }} importantForAccessibility="no-hide-descendants">
            {days.map((d, i) => (
              <Text key={d.day} variant="label" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                {dense ? (i % 5 === 0 || i === days.length - 1 ? new Date(d.day).getDate() : '') : dayName(d.day, 'narrow')}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function TableToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={table ? 'Show as chart' : 'Show as table'} onPress={onToggle} hitSlop={8}
      style={{ alignSelf: 'flex-end', paddingVertical: 2, paddingHorizontal: 6 }}>
      <Text variant="label" style={{ color: colors.red }}>{table ? 'CHART' : 'TABLE'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: colors.border },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  hit: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { backgroundColor: BAR, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  empty: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
