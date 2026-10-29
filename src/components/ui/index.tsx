import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Capy, type CapyPose } from '@/components/Capy';
import { MIN_TOUCH, accents, colors, radius, shadow, space, type Accent } from '@/constants/brand';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ---------- Text ---------- */
const textStyles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.navy, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.navy, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontSize: 15, fontWeight: '600', color: colors.navy, lineHeight: 21 },
  body: { fontSize: 15, color: colors.navy2, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, lineHeight: 16 },
});
export function Text({ variant = 'body', style, ...p }: React.ComponentProps<typeof RNText> & { variant?: keyof typeof textStyles }) {
  return <RNText {...p} style={[textStyles[variant], style]} />;
}

/* ---------- Screen & header ---------- */
/** `bleedTop`: the first child runs edge-to-edge under the status bar (it must add the top inset itself, see `useSafeAreaInsets`). */
export function Screen({ children, scroll = true, style, footer, bleedTop }: {
  children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; footer?: React.ReactNode; bleedTop?: boolean;
}) {
  const body = scroll
    ? <ScrollView contentContainerStyle={[styles.screenPad, style]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={[styles.screenPad, { flex: 1 }, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={bleedTop ? ['left', 'right'] : ['top', 'left', 'right']}>
      {body}
      {footer}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.navy} />
          </Pressable>
        ) : null}
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
        {right}
      </View>
      {subtitle ? <Text variant="body" style={{ marginTop: space.xs }}>{subtitle}</Text> : null}
    </View>
  );
}

/* ---------- Buttons ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityHint }: {
  label: string; onPress: () => void; variant?: BtnVariant; icon?: IconName; disabled?: boolean; loading?: boolean;
  style?: StyleProp<ViewStyle>; accessibilityHint?: string;
}) {
  const v = btnVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.btn, v.box, off && { opacity: 0.45 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={v.color} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={v.color} style={{ marginRight: 8 }} /> : null}
          <RNText style={{ color: v.color, fontSize: 16, fontWeight: '600' }}>{label}</RNText>
        </>
      )}
    </Pressable>
  );
}
const btnVariants: Record<BtnVariant, { box: ViewStyle; color: string }> = {
  primary: { box: { backgroundColor: colors.red }, color: '#fff' },
  secondary: { box: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.red }, color: colors.red },
  ghost: { box: { backgroundColor: 'transparent' }, color: colors.navy },
  danger: { box: { backgroundColor: colors.redTint, borderWidth: 1, borderColor: '#F5B8C2' }, color: colors.redDark },
};

export function IconButton({ icon, label, onPress, color = colors.navy, active }: {
  icon: IconName; label: string; onPress: () => void; color?: string; active?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress}
      style={styles.iconBtn} hitSlop={6}>
      <Ionicons name={icon} size={22} color={active ? colors.red : color} />
    </Pressable>
  );
}

/* ---------- Cards, chips, badges, notices ---------- */
export function Card({ children, onPress, tint, style, accessibilityLabel }: {
  children: React.ReactNode; onPress?: () => void; tint?: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const base = [styles.card, tint ? { backgroundColor: tint, borderColor: 'transparent' } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={[styles.chip, selected && styles.chipOn, disabled && { opacity: 0.45 }]}
    >
      {selected ? <Ionicons name="checkmark-circle" size={16} color={colors.red} style={{ marginRight: 6 }} /> : null}
      <RNText style={{ color: selected ? colors.redDark : colors.navy2, fontWeight: selected ? '700' : '500', fontSize: 14 }}>{label}</RNText>
    </Pressable>
  );
}

type BadgeTone = 'sample' | 'local' | 'neutral' | 'warn' | 'ok';
const badgeTones: Record<BadgeTone, { bg: string; fg: string; icon: IconName }> = {
  sample: { bg: colors.orange, fg: '#8A5300', icon: 'flask-outline' },
  local: { bg: colors.teal, fg: '#0B5E5A', icon: 'people-outline' },
  neutral: { bg: colors.sand, fg: colors.navy2, icon: 'ellipse-outline' },
  warn: { bg: colors.orange, fg: '#8A5300', icon: 'alert-circle-outline' },
  ok: { bg: colors.green, fg: '#0F6B43', icon: 'checkmark-circle-outline' },
};
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]} accessible accessibilityLabel={label}>
      <Ionicons name={t.icon} size={12} color={t.fg} style={{ marginRight: 4 }} />
      <RNText style={{ color: t.fg, fontSize: 12, fontWeight: '600' }}>{label}</RNText>
    </View>
  );
}

export function Notice({ text, icon = 'information-circle-outline', tone = 'info' }: { text: string; icon?: IconName; tone?: 'info' | 'warn' }) {
  const bg = tone === 'warn' ? colors.orange : colors.blue;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="text">
      <Ionicons name={icon} size={18} color={colors.navy2} style={{ marginRight: 8, marginTop: 1 }} />
      <Text variant="small" style={{ flex: 1, color: colors.navy2 }}>{text}</Text>
    </View>
  );
}

/* ---------- Inputs ---------- */
export function Field({ label, error, hint, ...p }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text variant="h3" style={{ marginBottom: space.xs }}>{label}</Text>
      <TextInput
        accessibilityLabel={label} placeholderTextColor={colors.muted}
        {...p}
        style={[styles.input, p.multiline && { minHeight: 140, textAlignVertical: 'top' }, !!error && { borderColor: colors.red }, p.style as StyleProp<TextStyle>]}
      />
      {hint ? <Text variant="small" style={{ marginTop: 4 }}>{hint}</Text> : null}
      {error ? <Text variant="small" style={{ color: colors.redDark, marginTop: 4 }} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

/* ---------- States ---------- */
export function Loading({ label = 'Just a moment…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={label} accessibilityLiveRegion="polite">
      <Capy pose="calm" size={84} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
        <ActivityIndicator color={colors.red} size="small" />
        <Text variant="small">{label}</Text>
      </View>
    </View>
  );
}
/** Capy keeps every empty or error screen company, like the character sheet's "No posts yet". */
export function EmptyState({ capy = 'thinking', title, text, action }: { capy?: CapyPose; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      <Capy pose={capy} size={120} />
      <Text variant="h3" style={{ marginTop: space.md, textAlign: 'center' }}>{title}</Text>
      {text ? <Text variant="small" style={{ textAlign: 'center', marginTop: 4 }}>{text}</Text> : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}
export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return <EmptyState capy="concerned" title="Something went wrong" text={text} action={onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : undefined} />;
}

/** Rounded-square icon box: soft tinted background with a saturated icon of the same hue. */
export function IconTile({ icon, accent = 'slate', size = 44, solid }: { icon: IconName; accent?: Accent; size?: number; solid?: boolean }) {
  const a = accents[accent];
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), alignItems: 'center', justifyContent: 'center',
      backgroundColor: solid ? a.fg : a.bg }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={solid ? '#fff' : a.fg} />
    </View>
  );
}

export function Row({ icon, title, subtitle, onPress, accent, right }: {
  icon: IconName; title: string; subtitle?: string; onPress: () => void; accent?: Accent; right?: React.ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sand }]}>
      <IconTile icon={icon} accent={accent} size={42} />
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

/** Groups Rows into one white rounded card. */
export function RowGroup({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      {title ? <Text variant="label" style={{ marginBottom: space.sm, marginLeft: space.xs, letterSpacing: 0.8 }}>{title.toUpperCase()}</Text> : null}
      <View style={styles.rowGroup}>{children}</View>
    </View>
  );
}

const ABB_LOGO = require('../../../assets/images/abb-logo.svg');
const LOGO_RATIO = 2000 / 793;

export function BrandMark({ light, height = 24 }: { light?: boolean; height?: number }) {
  const logo = <Image source={ABB_LOGO} style={{ height, width: height * LOGO_RATIO }} contentFit="contain" accessibilityIgnoresInvertColors />;
  return (
    <View accessible accessibilityLabel="ABB Help Me" style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* The logo sits on white on dark backgrounds to keep its colour true. */}
      {light ? <View style={{ backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 }}>{logo}</View> : logo}
      <View style={{ width: 1, height: 20, backgroundColor: light ? '#ffffff55' : colors.border, marginHorizontal: 10 }} />
      <RNText style={{ fontSize: 15, fontWeight: '700', color: light ? '#fff' : colors.navy, letterSpacing: 0.5 }}>HELP ME</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPad: { padding: space.lg, paddingBottom: space.xxl * 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border },
  btn: { minHeight: MIN_TOUCH, borderRadius: radius.md, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: '#EEF0F5', padding: space.lg, ...shadow },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chipOn: { borderColor: colors.red, backgroundColor: colors.redTint },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  notice: { flexDirection: 'row', padding: space.md, borderRadius: radius.lg, marginVertical: space.sm },
  input: { minHeight: MIN_TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 16, color: colors.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  rowGroup: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF0F5', backgroundColor: colors.surface, ...shadow },
});
