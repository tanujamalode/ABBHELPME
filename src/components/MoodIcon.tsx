import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accents, radius } from '@/constants/brand';
import type { Mood } from '@/data/types';
import { MOOD_ACCENT, MOOD_ICON } from '@/lib/moodStats';

/** Mood shown as a weather icon in a tinted tile (no emoji): sunny, partly sunny, cloudy, rainy. */
export function MoodIcon({ mood, size = 40, bare }: { mood: Mood; size?: number; bare?: boolean }) {
  const a = accents[MOOD_ACCENT[mood]];
  if (bare) return <Ionicons name={MOOD_ICON[mood]} size={size} color={a.fg} />;
  return (
    <View style={{ width: size, height: size, borderRadius: Math.min(radius.lg, size * 0.3), backgroundColor: a.bg,
      alignItems: 'center', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants">
      <Ionicons name={MOOD_ICON[mood]} size={Math.round(size * 0.56)} color={a.fg} />
    </View>
  );
}
