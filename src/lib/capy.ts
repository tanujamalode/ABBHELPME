import type { Mood } from '@/data/types';

/**
 * Capy's voice: warm, short, never guilt-tripping. Capy celebrates and encourages,
 * but never nags about missed check-ins and never claims to be a person, a counsellor, or AI.
 * Pose names match CapyPose in components/Capy.
 */
export type CapyPoseName =
  | 'laptop' | 'happy' | 'excited' | 'calm' | 'thinking' | 'concerned' | 'surprised' | 'winking' | 'cheerful'
  | 'headphones' | 'glasses' | 'coffee' | 'hi' | 'support' | 'cheer' | 'goodjob' | 'takecare' | 'yougotthis' | 'celebrate'
  | 'outfit_casual' | 'outfit_formal' | 'outfit_teamlead' | 'outfit_hr' | 'outfit_tech' | 'outfit_wellness';

export interface CapyLine { pose: CapyPoseName; text: string }

export function greeting(hour: number): string {
  if (hour < 5) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Capy dresses for the user's role (Outfits & Roles on the character sheet). */
export function outfitForRole(role: string | null | undefined): CapyPoseName {
  switch (role) {
    case 'hr': return 'outfit_hr';
    case 'it': case 'engineer': case 'senior_engineer': return 'outfit_tech';
    case 'manager': case 'project_manager': return 'outfit_teamlead';
    case 'sales': case 'finance': return 'outfit_formal';
    default: return 'outfit_casual';
  }
}

/** What Capy says on Home, based on today's check-in. */
export function homeLine(name: string, hour: number, todayMood: Mood | null): CapyLine {
  const who = name ? `, ${name}` : '';
  if (todayMood === 'struggling' || todayMood === 'not_great') {
    return { pose: 'support', text: `I'm here for you${who}. Want to talk it through or find support?` };
  }
  if (todayMood === 'great') return { pose: 'cheerful', text: `Love that energy${who}! Anything I can help with today?` };
  if (todayMood === 'okay') return { pose: 'happy', text: `Steady day${who}? I'm around if you need anything.` };
  if (hour >= 5 && hour < 11) return { pose: 'coffee', text: `Morning${who}! How are you feeling today?` };
  return { pose: 'hi', text: `Hi${who}! How are you feeling today?` };
}

/** Capy's reaction while choosing a mood, and after saving it. */
export const MOOD_REACTION: Record<Mood, { pick: CapyLine; saved: CapyLine }> = {
  great: {
    pick: { pose: 'excited', text: 'Yay! Tell me more?' },
    saved: { pose: 'goodjob', text: 'Saved. Keep that good day going!' },
  },
  okay: {
    pick: { pose: 'calm', text: 'Okay is okay.' },
    saved: { pose: 'happy', text: 'Saved. Small steps make a big difference.' },
  },
  not_great: {
    pick: { pose: 'concerned', text: "Sorry it's a tough one." },
    saved: { pose: 'takecare', text: 'Saved. Be kind to yourself today.' },
  },
  struggling: {
    pick: { pose: 'support', text: "That sounds hard. You're not alone." },
    saved: { pose: 'support', text: "Saved. If it's heavy, support is one tap away." },
  },
};

export function topicsLine(count: number, min: number): CapyLine {
  if (count === 0) return { pose: 'thinking', text: `What's on your plate? Pick at least ${min} topics.` };
  if (count < min) return { pose: 'happy', text: `Nice! ${min - count} more to go.` };
  return { pose: 'cheerful', text: 'Great picks! I\'ll keep these in mind.' };
}

export function tierLine(tierId: string): CapyLine {
  switch (tierId) {
    case 'newcomer': return { pose: 'yougotthis', text: 'Every answer helps someone. You got this!' };
    case 'contributor': return { pose: 'goodjob', text: "You're making a difference. Good job!" };
    case 'helper': return { pose: 'cheer', text: 'People count on your answers!' };
    default: return { pose: 'celebrate', text: 'You lift the whole community. Thank you!' };
  }
}
