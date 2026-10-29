import {
  DURATIONS, MICRO_BREAKS, PATTERNS, breakSeconds, cycleSeconds, decodePreset, encodePreset, microBreakById, patternById,
  phaseAt, phaseTargetScale, presetLabel, stepAt, wellnessProgress,
} from '@/lib/wellness';
import type { WellnessSession } from '@/data/types';

describe('breathing patterns', () => {
  it('includes the 4-4-6 pattern', () => {
    expect(patternById('446').phases.map((p) => p.seconds)).toEqual([4, 4, 6]);
    expect(cycleSeconds(patternById('446'))).toBe(14);
  });

  it('walks through the phases and repeats', () => {
    const p = patternById('446');
    expect(phaseAt(p, 0)).toMatchObject({ index: 0, secondsLeft: 4, cycle: 0 });
    expect(phaseAt(p, 3.2)).toMatchObject({ index: 0, secondsLeft: 1 });
    expect(phaseAt(p, 4)).toMatchObject({ index: 1, secondsLeft: 4 });
    expect(phaseAt(p, 8)).toMatchObject({ index: 2, secondsLeft: 6 });
    expect(phaseAt(p, 14)).toMatchObject({ index: 0, cycle: 1 });
    expect(phaseAt(p, 14 * 3 + 9).phase.name).toBe('Breathe out');
  });

  it('grows the circle on the in-breath and shrinks it on the out-breath', () => {
    expect(phaseTargetScale('Breathe in', 0.55)).toBe(1);
    expect(phaseTargetScale('Breathe out', 1)).toBe(0.55);
    expect(phaseTargetScale('Hold', 1)).toBe(1);
  });

  it('offers 1 to 10 minute sessions and several patterns', () => {
    expect([...DURATIONS]).toEqual([1, 3, 5, 10]);
    expect(PATTERNS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('saved session presets', () => {
  it('round-trips and rejects bad values', () => {
    const preset = { mode: 'sleep' as const, pattern: '478', minutes: 10, sound: 'rain' as const };
    expect(decodePreset(encodePreset(preset))).toEqual(preset);
    expect(presetLabel(preset)).toBe('Sleep · 4-7-8 · 10 min · Rain');
    expect(decodePreset('nonsense')).toBeNull();
    expect(decodePreset('breathing|446|500|none')).toBeNull();
    expect(decodePreset('breathing|zzz|5|none')).toBeNull();
  });
});

describe('micro-breaks', () => {
  it('covers eyes, stretching, breathing, movement, walking and hydration', () => {
    expect(new Set(MICRO_BREAKS.map((b) => b.category))).toEqual(new Set(['Eyes', 'Stretch', 'Breathe', 'Move', 'Walk', 'Hydrate']));
  });

  it('keeps each break short (at most six minutes) and finds the active step', () => {
    for (const b of MICRO_BREAKS) expect(breakSeconds(b)).toBeLessThanOrEqual(360);
    const b = microBreakById('eyes-20')!;
    expect(stepAt(b, 0)).toMatchObject({ index: 0, secondsLeft: 20 });
    expect(stepAt(b, 20)).toMatchObject({ index: 1 });
    expect(stepAt(b, breakSeconds(b))).toBeNull();
    expect(microBreakById('missing')).toBeNull();
  });
});

describe('wellness progress', () => {
  const noon = new Date(2026, 5, 15, 12).getTime();
  const DAY = 86_400_000;
  const s = (kind: WellnessSession['kind'], minutes: number, at: number): WellnessSession => ({ id: String(at) + kind, kind, slug: 'x', minutes, createdAt: at });

  it('adds up minutes this week and in total, and counts resets separately', () => {
    const p = wellnessProgress([
      s('meditation', 5, noon - 1000), s('breathing', 2.5, noon - DAY), s('microbreak', 1, noon - 2 * DAY), s('sleep', 10, noon - 20 * DAY),
    ], noon);
    expect(p.minutesThisWeek).toBe(7.5);
    expect(p.minutesTotal).toBe(17.5);
    expect(p.sessionsThisWeek).toBe(2);
    expect(p.resetsCompleted).toBe(1);
    expect(p.days).toHaveLength(7);
    expect(p.days[6].minutes).toBe(5);
  });

  it('is all zeros with no sessions', () => {
    expect(wellnessProgress([], noon)).toMatchObject({ minutesThisWeek: 0, minutesTotal: 0, sessionsThisWeek: 0, resetsCompleted: 0 });
  });
});
