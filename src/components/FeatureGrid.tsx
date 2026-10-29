import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Badge, IconTile, Text, type IconName } from '@/components/ui';
import { colors, radius, shadow, space, type Accent } from '@/constants/brand';

export interface Feature { label: string; hint: string; icon: IconName; accent: Accent; href: Href; badge?: number }

/** Tiles that open the wellbeing, connection and recognition features. */
export function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <View style={styles.grid}>
      {items.map((f) => (
        <Pressable key={f.label} accessibilityRole="button" accessibilityLabel={`${f.label}. ${f.hint}${f.badge ? `. ${f.badge} new` : ''}`}
          onPress={() => router.push(f.href)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
          <View style={styles.top}>
            <IconTile icon={f.icon} accent={f.accent} size={40} />
            {f.badge ? <Badge label={String(f.badge)} tone="ok" /> : null}
          </View>
          <Text variant="h3" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={2}>{f.label}</Text>
          <Text variant="small" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>{f.hint}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm + 2, marginBottom: space.xl },
  tile: { width: '48.5%', padding: space.md, gap: 4, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#EEF0F5', ...shadow },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
});
