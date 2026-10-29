import { useEffect } from 'react';
import { Text as RNText, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, radius, shadow, space } from '@/constants/brand';
import type { CapyPoseName } from '@/lib/capy';

/**
 * Capy, the app mascot. Poses are cut from the Capy character sheet (assets/capy).
 * Replace a file with a higher-resolution export of the same pose and name to upgrade it.
 */
const POSES: Record<CapyPoseName, { src: number; ratio: number }> = {
  laptop: { src: require('../../assets/capy/laptop.png'), ratio: 0.848 },
  happy: { src: require('../../assets/capy/happy.png'), ratio: 0.99 },
  excited: { src: require('../../assets/capy/excited.png'), ratio: 0.953 },
  calm: { src: require('../../assets/capy/calm.png'), ratio: 0.948 },
  thinking: { src: require('../../assets/capy/thinking.png'), ratio: 0.807 },
  concerned: { src: require('../../assets/capy/concerned.png'), ratio: 0.906 },
  surprised: { src: require('../../assets/capy/surprised.png'), ratio: 1.0 },
  winking: { src: require('../../assets/capy/winking.png'), ratio: 0.92 },
  cheerful: { src: require('../../assets/capy/cheerful.png'), ratio: 1.051 },
  headphones: { src: require('../../assets/capy/headphones.png'), ratio: 1.0 },
  glasses: { src: require('../../assets/capy/glasses.png'), ratio: 1.0 },
  coffee: { src: require('../../assets/capy/coffee.png'), ratio: 0.86 },
  hi: { src: require('../../assets/capy/hi.png'), ratio: 1.083 },
  support: { src: require('../../assets/capy/support.png'), ratio: 1.0 },
  cheer: { src: require('../../assets/capy/cheer.png'), ratio: 0.984 },
  goodjob: { src: require('../../assets/capy/goodjob.png'), ratio: 1.102 },
  takecare: { src: require('../../assets/capy/takecare.png'), ratio: 1.115 },
  yougotthis: { src: require('../../assets/capy/yougotthis.png'), ratio: 1.068 },
  celebrate: { src: require('../../assets/capy/celebrate.png'), ratio: 0.939 },
  outfit_casual: { src: require('../../assets/capy/outfit_casual.png'), ratio: 0.678 },
  outfit_formal: { src: require('../../assets/capy/outfit_formal.png'), ratio: 0.679 },
  outfit_teamlead: { src: require('../../assets/capy/outfit_teamlead.png'), ratio: 0.689 },
  outfit_hr: { src: require('../../assets/capy/outfit_hr.png'), ratio: 0.667 },
  outfit_tech: { src: require('../../assets/capy/outfit_tech.png'), ratio: 0.656 },
  outfit_wellness: { src: require('../../assets/capy/outfit_wellness.png'), ratio: 0.782 },
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
