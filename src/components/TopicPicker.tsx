import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconTile, Text, type IconName } from '@/components/ui';
import { accents, colors, radius, space, type Accent } from '@/constants/brand';
import { MIN_TOPIC_COUNT, TOPIC_CATALOGUE, toggleTopic } from '@/lib/topics';

const TOPIC_STYLE: Record<(typeof TOPIC_CATALOGUE)[number]['id'], { icon: IconName; accent: Accent }> = {
  mental: { icon: 'heart-outline', accent: 'rose' },
  workplace: { icon: 'business-outline', accent: 'blue' },
  relationships: { icon: 'chatbubbles-outline', accent: 'violet' },
  career: { icon: 'trending-up-outline', accent: 'green' },
  team: { icon: 'people-outline', accent: 'teal' },
  personal: { icon: 'sunny-outline', accent: 'amber' },
  questions: { icon: 'help-circle-outline', accent: 'slate' },
};

export function TopicPicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <View style={styles.grid}>
      {TOPIC_CATALOGUE.map((t) => {
        const on = selected.includes(t.id);
        const st = TOPIC_STYLE[t.id];
        return (
          <Pressable key={t.id} accessibilityRole="checkbox" accessibilityLabel={t.label} accessibilityState={{ checked: on }}
            onPress={() => onChange(toggleTopic(selected, t.id))}
            style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.85 }]}>
            <View style={styles.tileTop}>
              <IconTile icon={st.icon} accent={st.accent} size={40} />
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.red : colors.border} />
            </View>
            <Text variant="h3" style={{ fontSize: 14, lineHeight: 19, color: on ? colors.navy : colors.navy2 }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TopicProgress({ count }: { count: number }) {
  const done = count >= MIN_TOPIC_COUNT;
  const pct = Math.min(1, count / MIN_TOPIC_COUNT);
  return (
    <View accessibilityLiveRegion="polite" accessible
      accessibilityLabel={done ? `${count} categories selected` : `Choose at least ${MIN_TOPIC_COUNT} category`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text variant="h3">{done ? `${count} selected` : 'None selected yet'}</Text>
        {done ? <Text variant="small" style={{ color: accents.green.fg, fontWeight: '600' }}>Ready to go</Text>
          : <Text variant="small">Pick at least one</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: done ? accents.green.fg : colors.red }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm + 2 },
  tile: { width: '48.5%', minHeight: 112, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, gap: space.sm },
  tileOn: { borderColor: colors.red, backgroundColor: '#FFF7F8' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
