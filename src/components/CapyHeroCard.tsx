import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Capy, type CapyPose } from '@/components/Capy';
import { Text, type IconName } from '@/components/ui';
import { colors, shadow, space } from '@/constants/brand';

export type HeroAction = { icon: IconName; label: string; onPress: () => void; primary?: boolean };
export type HeroSlide = { key: string; kicker: string; title: string; pose: CapyPose; capySize?: number; actions: HeroAction[] };

const SLIDE_H = 196;

/**
 * Navy ABB hero card in the "your doctor" style, mirrored: Capy large on the left and cut off by the card's
 * bottom edge, text and round actions on the right, with page dots under the card. Swipe between slides.
 *
 * `flush`: the card runs edge-to-edge to the top of the screen with only the bottom corners rounded,
 * and `top` (e.g. the app bar) sits inside it above the slides.
 */
export function CapyHeroCard({ slides, flush, top }: { slides: HeroSlide[]; flush?: boolean; top?: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  return (
    <View>
      <View style={[styles.card, flush ? styles.flush : styles.rounded, shadow]}>
        {/* Soft red glow and ring; static, so they also sit behind the app bar when flush. */}
        <View style={styles.glow} pointerEvents="none" />
        <View style={styles.ring} pointerEvents="none" />
        {top}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable" accessibilityLabel={`${slides[page]?.kicker}. ${slides[page]?.title}`}>
          {width ? slides.map((s) => (
            <View key={s.key} style={[styles.slide, { width }]}>
              <View style={styles.capy} pointerEvents="none">
                <Capy pose={s.pose} size={s.capySize ?? 178} motion="idle" />
              </View>
              <View style={styles.copy}>
                <Text style={styles.kicker} numberOfLines={1}>{s.kicker}</Text>
                <Text style={styles.title} numberOfLines={3} accessibilityRole="header">{s.title}</Text>
              </View>
              <View style={styles.actions}>
                {s.actions.map((a) => (
                  <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} hitSlop={4}
                    style={({ pressed }) => [styles.round, a.primary && styles.roundPrimary, pressed && { transform: [{ scale: 0.92 }] }]}>
                    <Ionicons name={a.icon} size={20} color="#fff" />
                  </Pressable>
                ))}
                {/* Name the main action when there's room for it (two buttons or fewer). */}
                {s.actions.length <= 2 ? <Text style={styles.actionHint} numberOfLines={1}>{s.actions.find((a) => a.primary)?.label ?? ''}</Text> : null}
              </View>
            </View>
          )) : <View style={{ height: SLIDE_H }} />}
        </ScrollView>
      </View>

      {slides.length > 1 ? (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {slides.map((s, i) => <View key={s.key} style={[styles.dot, i === page && styles.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.navy, overflow: 'hidden' },
  rounded: { borderRadius: 28 },
  flush: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  slide: { height: SLIDE_H, padding: space.lg, justifyContent: 'space-between', overflow: 'hidden' },
  glow: { position: 'absolute', left: -70, bottom: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.red, opacity: 0.22 },
  ring: { position: 'absolute', left: -30, bottom: -90, width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: '#ffffff22' },
  capy: { position: 'absolute', left: space.sm, bottom: -26 },
  copy: { width: '58%', alignSelf: 'flex-end' },
  kicker: { color: '#C9D1E2', fontSize: 13, fontWeight: '600' },
  title: { color: '#fff', fontSize: 24, lineHeight: 29, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, width: '58%', alignSelf: 'flex-end' },
  round: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#ffffff55', alignItems: 'center', justifyContent: 'center' },
  roundPrimary: { backgroundColor: colors.red, borderColor: colors.red },
  actionHint: { color: '#C9D1E2', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { width: 22, backgroundColor: colors.navy },
});
