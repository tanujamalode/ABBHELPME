import type { WellnessKind, WellnessSession } from '@/data/types';
import type { IconName } from '@/components/ui';
import type { Accent } from '@/constants/brand';

/* ---------------------------------------------------------------------------------------------
 * Breathing patterns and meditation
 * ------------------------------------------------------------------------------------------- */
export type PhaseName = 'Breathe in' | 'Hold' | 'Breathe out' | 'Rest';
export interface Phase { name: PhaseName; seconds: number }
export interface BreathPattern { id: string; label: string; hint: string; phases: Phase[] }

const inn = (seconds: number): Phase => ({ name: 'Breathe in', seconds });
const hold = (seconds: number): Phase => ({ name: 'Hold', seconds });
const out = (seconds: number): Phase => ({ name: 'Breathe out', seconds });
const rest = (seconds: number): Phase => ({ name: 'Rest', seconds });

export const PATTERNS: BreathPattern[] = [
  { id: '446', label: '4-4-6', hint: 'In 4, hold 4, out 6. A long out-breath settles you.', phases: [inn(4), hold(4), out(6)] },
  { id: 'box', label: 'Box 4-4-4-4', hint: 'Equal sides: in, hold, out, rest. Steady and focusing.', phases: [inn(4), hold(4), out(4), rest(4)] },
  { id: '478', label: '4-7-8', hint: 'In 4, hold 7, out 8. Good for winding down before sleep.', phases: [inn(4), hold(7), out(8)] },
  { id: 'calm', label: 'Calm 5-5', hint: 'In 5, out 5. Simple and even.', phases: [inn(5), out(5)] },
];

export const patternById = (id: string): BreathPattern => PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
export const cycleSeconds = (p: BreathPattern) => p.phases.reduce((n, ph) => n + ph.seconds, 0);

export interface PhaseState { phase: Phase; index: number; secondsLeft: number; cycle: number }

/** Where in the pattern we are after `elapsed` seconds. */
export function phaseAt(pattern: BreathPattern, elapsed: number): PhaseState {
  const total = cycleSeconds(pattern);
  const cycle = Math.floor(elapsed / total);
  let t = elapsed - cycle * total;
  for (let i = 0; i < pattern.phases.length; i++) {
    const ph = pattern.phases[i];
    if (t < ph.seconds) return { phase: ph, index: i, secondsLeft: Math.ceil(ph.seconds - t), cycle };
    t -= ph.seconds;
  }
  return { phase: pattern.phases[0], index: 0, secondsLeft: pattern.phases[0].seconds, cycle };
}

/** Circle size at the end of a phase: full after breathing in, small after breathing out, unchanged while holding. */
export const SCALE_SMALL = 0.55;
export function phaseTargetScale(name: PhaseName, current: number): number {
  if (name === 'Breathe in') return 1;
  if (name === 'Breathe out') return SCALE_SMALL;
  return current;
}

export const MEDITATION_PROMPTS = [
  'Settle into a comfortable position.',
  'Notice the breath moving in and out.',
  'If your mind wanders, gently come back.',
  'Soften your shoulders and jaw.',
  'There is nothing to fix right now.',
  'Feel your feet on the floor.',
  'Let each out-breath be a little longer.',
  'You are doing just fine.',
];

export const SLEEP_PROMPTS = [
  'Let your body feel heavy.',
  'Relax your forehead, eyes and jaw.',
  'Let go of today. It can wait.',
  'Breathe slowly. There is nowhere to be.',
  'Soften your hands and arms.',
  'Let your legs feel warm and heavy.',
];

export const DURATIONS = [1, 3, 5, 10] as const;

export type SoundId = 'none' | 'rain' | 'forest' | 'ocean';
export const SOUNDS: { id: SoundId; label: string; icon: IconName }[] = [
  { id: 'none', label: 'Silence', icon: 'volume-mute-outline' },
  { id: 'rain', label: 'Rain', icon: 'rainy-outline' },
  { id: 'forest', label: 'Forest', icon: 'leaf-outline' },
  { id: 'ocean', label: 'Ocean', icon: 'water-outline' },
];

export type SessionMode = 'breathing' | 'meditation' | 'sleep';
export interface SessionPreset { mode: SessionMode; pattern: string; minutes: number; sound: SoundId }

/** Presets are saved as one short string so they fit the bookmarks table. */
export const encodePreset = (p: SessionPreset) => `${p.mode}|${p.pattern}|${p.minutes}|${p.sound}`;
export function decodePreset(s: string): SessionPreset | null {
  const [mode, pattern, minutes, sound] = s.split('|');
  const m = Number(minutes);
  if (!['breathing', 'meditation', 'sleep'].includes(mode) || !PATTERNS.some((p) => p.id === pattern) || !(m > 0 && m <= 30)) return null;
  if (!SOUNDS.some((x) => x.id === sound)) return null;
  return { mode: mode as SessionMode, pattern, minutes: m, sound: sound as SoundId };
}
export const presetLabel = (p: SessionPreset) =>
  `${p.mode === 'sleep' ? 'Sleep' : p.mode === 'meditation' ? 'Meditation' : 'Breathing'} · ${patternById(p.pattern).label} · ${p.minutes} min`
  + (p.sound !== 'none' ? ` · ${SOUNDS.find((s) => s.id === p.sound)?.label}` : '');

/* ---------------------------------------------------------------------------------------------
 * Micro-breaks
 * ------------------------------------------------------------------------------------------- */
export interface BreakStep { text: string; seconds: number }
export interface MicroBreak {
  id: string; title: string; blurb: string; category: 'Eyes' | 'Stretch' | 'Breathe' | 'Move' | 'Walk' | 'Hydrate';
  icon: IconName; accent: Accent; steps: BreakStep[];
}

export const MICRO_BREAKS: MicroBreak[] = [
  { id: 'eyes-20', title: 'Eye reset (20-20-20)', blurb: 'Look far away to rest tired eyes.', category: 'Eyes', icon: 'eye-outline', accent: 'blue', steps: [
    { text: 'Look away from your screen at something about 6 metres (20 feet) away.', seconds: 20 },
    { text: 'Blink slowly ten times.', seconds: 15 },
    { text: 'Roll your eyes slowly: up, right, down, left. Then reverse.', seconds: 20 },
    { text: 'Cup your warm palms over closed eyes and rest.', seconds: 20 },
  ] },
  { id: 'stretch-neck', title: 'Neck & shoulders', blurb: 'Release the tension that builds at a desk.', category: 'Stretch', icon: 'body-outline', accent: 'violet', steps: [
    { text: 'Drop your shoulders away from your ears. Breathe out.', seconds: 15 },
    { text: 'Tilt your right ear toward your right shoulder. Hold gently.', seconds: 20 },
    { text: 'Tilt your left ear toward your left shoulder. Hold gently.', seconds: 20 },
    { text: 'Roll your shoulders back in slow circles.', seconds: 25 },
    { text: 'Clasp your hands behind you and open your chest.', seconds: 20 },
  ] },
  { id: 'stretch-desk', title: 'Desk stretch', blurb: 'Wrists, back and hips in two minutes.', category: 'Stretch', icon: 'accessibility-outline', accent: 'teal', steps: [
    { text: 'Stretch your arms overhead and reach up tall.', seconds: 20 },
    { text: 'Twist gently to the right, holding your chair. Then the left.', seconds: 30 },
    { text: 'Extend one arm, palm up, and pull the fingers back. Switch.', seconds: 30 },
    { text: 'Stand up and fold forward with soft knees.', seconds: 25 },
    { text: 'Stand tall and take three deep breaths.', seconds: 15 },
  ] },
  { id: 'breathe-1', title: 'One-minute breathing', blurb: 'A quick reset: four slow breaths in, six out.', category: 'Breathe', icon: 'leaf-outline', accent: 'green', steps: [
    { text: 'Sit tall and relax your belly.', seconds: 8 },
    { text: 'Breathe in through your nose for 4.', seconds: 12 },
    { text: 'Breathe out slowly for 6. Repeat at your own pace.', seconds: 40 },
  ] },
  { id: 'move-reset', title: 'Move your body', blurb: 'Get the blood flowing.', category: 'Move', icon: 'walk-outline', accent: 'amber', steps: [
    { text: 'March on the spot, lifting your knees.', seconds: 30 },
    { text: 'Reach up high, then touch your toes. Repeat.', seconds: 30 },
    { text: 'Shake out your arms, hands and legs.', seconds: 20 },
    { text: 'Roll your ankles and wrists.', seconds: 20 },
  ] },
  { id: 'walk-5', title: 'Walking break', blurb: 'Five minutes away from your desk.', category: 'Walk', icon: 'footsteps-outline', accent: 'rose', steps: [
    { text: 'Stand up and head outside or down the corridor. Leave your phone on silent.', seconds: 30 },
    { text: 'Walk at an easy pace. Notice what you can see, hear and smell.', seconds: 240 },
    { text: 'Head back, shoulders relaxed.', seconds: 30 },
  ] },
  { id: 'hydrate', title: 'Water break', blurb: 'A glass of water and a stretch.', category: 'Hydrate', icon: 'water-outline', accent: 'blue', steps: [
    { text: 'Fill a glass or bottle with water.', seconds: 20 },
    { text: 'Drink slowly. Notice how it feels.', seconds: 30 },
    { text: 'Stretch your back and shoulders before you sit down.', seconds: 20 },
  ] },
];

export const microBreakById = (id: string) => MICRO_BREAKS.find((b) => b.id === id) ?? null;
export const breakSeconds = (b: MicroBreak) => b.steps.reduce((n, s) => n + s.seconds, 0);

/** Which step is active after `elapsed` seconds, or null when the break is over. */
export function stepAt(b: MicroBreak, elapsed: number): { index: number; secondsLeft: number } | null {
  let t = elapsed;
  for (let i = 0; i < b.steps.length; i++) {
    if (t < b.steps[i].seconds) return { index: i, secondsLeft: Math.ceil(b.steps[i].seconds - t) };
    t -= b.steps[i].seconds;
  }
  return null;
}

/* ---------------------------------------------------------------------------------------------
 * Progress (no streaks, no scores)
 * ------------------------------------------------------------------------------------------- */
const DAY = 86_400_000;
export const startOfLocalDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export interface WellnessProgress {
  minutesThisWeek: number;
  minutesTotal: number;
  sessionsThisWeek: number;
  resetsCompleted: number;
  /** Last 7 days, oldest first. */
  days: { day: number; minutes: number }[];
}

export function wellnessProgress(sessions: WellnessSession[], now = Date.now()): WellnessProgress {
  const today = startOfLocalDay(now);
  const days = Array.from({ length: 7 }, (_, i) => ({ day: today - (6 - i) * DAY, minutes: 0 }));
  let minutesTotal = 0, minutesThisWeek = 0, sessionsThisWeek = 0, resetsCompleted = 0;
  for (const s of sessions) {
    if (s.kind === 'microbreak') resetsCompleted += 1;
    else minutesTotal += s.minutes;
    const bucket = days.find((d) => s.createdAt >= d.day && s.createdAt < d.day + DAY);
    if (bucket) {
      bucket.minutes += s.minutes;
      if (s.kind !== 'microbreak') { minutesThisWeek += s.minutes; sessionsThisWeek += 1; }
    }
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return { minutesThisWeek: round(minutesThisWeek), minutesTotal: round(minutesTotal), sessionsThisWeek, resetsCompleted,
    days: days.map((d) => ({ ...d, minutes: round(d.minutes) })) };
}

export const KIND_OF_MODE: Record<SessionMode, WellnessKind> = { breathing: 'breathing', meditation: 'meditation', sleep: 'sleep' };
