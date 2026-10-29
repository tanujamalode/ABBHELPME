import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { MIN_TOUCH, colors, radius, space } from '@/constants/brand';

export type Option = { id: string; label: string; hint?: string };

/** Bottom sheet with a list of options. Works the same on iOS, Android and web. */
export function OptionSheet({ visible, title, subtitle, options, selected, onSelect, onClose }: {
  visible: boolean; title: string; subtitle?: string; options: readonly Option[]; selected?: string | null;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <Text variant="h2" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="small" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
        <ScrollView style={{ marginTop: space.md }} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
          {options.map((o) => {
            const on = o.id === selected;
            return (
              <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
                onPress={() => { onSelect(o.id); onClose(); }}
                style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { opacity: 0.8 }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" style={{ color: on ? colors.redDark : colors.navy }}>{o.label}</Text>
                  {o.hint ? <Text variant="small">{o.hint}</Text> : null}
                </View>
                {on ? <Ionicons name="checkmark-circle" size={22} color={colors.red} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Form field that opens an OptionSheet: the app's dropdown. */
export function Select({ label, placeholder = 'Choose…', options, value, onChange, hint, error }: {
  label: string; placeholder?: string; options: readonly Option[]; value: string | null; onChange: (id: string) => void;
  hint?: string; error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text variant="h3" style={{ marginBottom: space.xs }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? 'not chosen'}`} accessibilityHint="Opens a list"
        onPress={() => setOpen(true)} style={[styles.field, !!error && { borderColor: colors.red }]}>
        <Text variant="body" style={{ flex: 1, color: current ? colors.navy : colors.muted }}>{current?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {hint ? <Text variant="small" style={{ marginTop: 4 }}>{hint}</Text> : null}
      {error ? <Text variant="small" style={{ color: colors.redDark, marginTop: 4 }} accessibilityLiveRegion="polite">{error}</Text> : null}
      <OptionSheet visible={open} title={label} options={options} selected={value} onSelect={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0F1B3366' },
  sheet: { maxHeight: '75%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.lg },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.md },
  option: { minHeight: MIN_TOUCH + 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optionOn: { borderColor: colors.red, backgroundColor: colors.redTint },
  field: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: space.md },
});
