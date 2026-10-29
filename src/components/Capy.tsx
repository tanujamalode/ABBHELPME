import { useEffect } from 'react';
import { Text as RNText, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, radius, shadow, space } from '@/constants/brand';
import type { CapyPoseName } from '@/lib/capy';

/**
 * Cappy, the app mascot. The poses in assets/capy are transparent cut-outs of the character renders in
 * assets/capy-source (WebP, 800 px on the long side). `ratio` is width / height of each file.
 * `happy` reuses the excited render and `glasses` the glasses-and-tablet render: they have no image of their own.
 */
const POSES: Record<CapyPoseName, { src: number; ratio: number }> = {
  laptop: { src: require('../../assets/capy/laptop.webp'), ratio: 0.902 },
  happy: { src: require('../../assets/capy/excited.webp'), ratio: 0.975 },
  excited: { src: require('../../assets/capy/excited.webp'), ratio: 0.975 },
  calm: { src: require('../../assets/capy/calm.webp'), ratio: 0.959 },
  thinking: { src: require('../../assets/capy/thinking.webp'), ratio: 0.907 },
  concerned: { src: require('../../assets/capy/concerned.webp'), ratio: 0.944 },
  surprised: { src: require('../../assets/capy/surprised.webp'), ratio: 1.001 },
  winking: { src: require('../../assets/capy/winking.webp'), ratio: 0.979 },
  cheerful: { src: require('../../assets/capy/cheerful.webp'), ratio: 0.968 },
  headphones: { src: require('../../assets/capy/headphones.webp'), ratio: 0.97 },
  glasses: { src: require('../../assets/capy/goodjob.webp'), ratio: 1.001 },
  coffee: { src: require('../../assets/capy/coffee.webp'), ratio: 0.881 },
  hi: { src: require('../../assets/capy/hi.webp'), ratio: 1.067 },
  support: { src: require('../../assets/capy/support.webp'), ratio: 1.001 },
  cheer: { src: require('../../assets/capy/cheer.webp'), ratio: 1.0 },
  goodjob: { src: require('../../assets/capy/goodjob.webp'), ratio: 1.001 },
  takecare: { src: require('../../assets/capy/takecare.webp'), ratio: 1.093 },
  yougotthis: { src: require('../../assets/capy/yougotthis.webp'), ratio: 1.072 },
  celebrate: { src: require('../../assets/capy/celebrate.webp'), ratio: 1.0 },
  outfit_casual: { src: require('../../assets/capy/outfit_casual.webp'), ratio: 0.647 },
  outfit_formal: { src: require('../../assets/capy/outfit_formal.webp'), ratio: 0.677 },
  outfit_teamlead: { src: require('../../assets/capy/outfit_teamlead.webp'), ratio: 0.669 },
  outfit_hr: { src: require('../../assets/capy/outfit_hr.webp'), ratio: 0.682 },
  outfit_tech: { src: require('../../assets/capy/outfit_tech.webp'), ratio: 0.645 },
  outfit_wellness: { src: require('../../assets/capy/outfit_wellness.webp'), ratio: 0.728 },
};

export type CapyPose = CapyPoseName;

/**
 * @param size height in points; width follows the pose's aspect ratio
 * @param motion 'idle' bobs gently, 'pop' springs in once whenever the pose changes, 'none' is static.
 *   All motion is skipped when the device asks for reduced motion.
 */
export function Capy({ pose = 'happy', size = 120, motion = 'idle', style, label }: {
  pose?: CapyPose; size?: number; motion?: 'idle' | 'pop' | 'none'; style?: StyleProp<ViewStyle>; label?: string;
}) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduce || motion !== 'idle') { y.value = 0; return; }
    y.value = withRepeat(withSequence(
      withTiming(-size * 0.03, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
    ), -1);
  }, [reduce, motion, size, y]);

  useEffect(() => {
    if (reduce || motion === 'none') return;
    scale.value = 0.82;
    scale.value = withSpring(1, { damping: 9, stiffness: 180 });
  }, [pose, reduce, motion, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: scale.value }] }));
  const p = POSES[pose];

  return (
    <Animated.View style={[{ width: size * p.ratio, height: size }, anim, style]}
      accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}>
      <Image source={p.src} style={StyleSheet.absoluteFill} contentFit="contain" />
    </Animated.View>
  );
}

/** Capy with a speech bubble. `side` is where Capy sits relative to the bubble. */
export function CapySays({ pose, message, size = 96, side = 'left', children, tint = colors.surface, motion = 'idle' }: {
  pose: CapyPose; message: string; size?: number; side?: 'left' | 'right' | 'top';
  children?: React.ReactNode; tint?: string; motion?: 'idle' | 'pop' | 'none';
}) {
  const bubble = (
    <View style={[styles.bubble, { backgroundColor: tint }, side === 'top' && { alignSelf: 'stretch' }]}>
      <View style={[styles.tail, { backgroundColor: tint },
        side === 'left' ? styles.tailLeft : side === 'right' ? styles.tailRight : styles.tailTop]} />
      <RNText style={styles.message} accessibilityLiveRegion="polite">{message}</RNText>
      {children ? <View style={{ marginTop: space.sm }}>{children}</View> : null}
    </View>
  );
  if (side === 'top') {
    return (
      <View style={{ alignItems: 'center', gap: space.md }} accessible={false}>
        <Capy pose={pose} size={size} motion={motion} />
        {bubble}
      </View>
    );
  }
  return (
    <View style={[styles.row, side === 'right' && { flexDirection: 'row-reverse' }]}>
      <Capy pose={pose} size={size} motion={motion} />
      <View style={{ flex: 1 }}>{bubble}</View>
    </View>
  );
}

/** Round Capy avatar (face crop) for chat and lists. */
export function CapyAvatar({ size = 40, pose = 'happy', ring = colors.red }: { size?: number; pose?: CapyPose; ring?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#FFF3E8',
      borderWidth: 2, borderColor: ring }} importantForAccessibility="no-hide-descendants">
      <Image source={POSES[pose].src} style={{ width: size * 1.15, height: size * 1.15, marginLeft: -size * 0.06, marginTop: -size * 0.02 }}
        contentFit="cover" contentPosition="top" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bubble: { padding: space.md, borderRadius: radius.xl, ...shadow },
  message: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.navy },
  tail: { position: 'absolute', width: 14, height: 14, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -6, top: '50%', marginTop: -7 },
  tailRight: { right: -6, top: '50%', marginTop: -7 },
  tailTop: { top: -6, left: '50%', marginLeft: -7 },
});
