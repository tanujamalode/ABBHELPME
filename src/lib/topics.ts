export const MIN_TOPIC_COUNT = 3;

export const TOPIC_CATALOGUE = [
  { id: 'wellbeing', label: 'Emotional well-being and stress' },
  { id: 'balance', label: 'Work-life balance and burnout' },
  { id: 'family', label: 'Relationships, family, and caregiving' },
  { id: 'team', label: 'Team communication and manager support' },
  { id: 'career', label: 'Career, learning, and growth' },
  { id: 'hr', label: 'HR, policies, and benefits' },
  { id: 'it', label: 'IT, tools, and access' },
  { id: 'workplace', label: 'Workplace, facilities, and accessibility' },
  { id: 'inclusion', label: 'Inclusion and belonging' },
  { id: 'finance', label: 'Personal finances and practical support' },
  { id: 'safety', label: 'Health, safety, and urgent help' },
  { id: 'process', label: 'Work processes and general questions' },
] as const;

/** Select or deselect a topic. There is no upper limit; any number may be chosen. */
export function toggleTopic(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((t) => t !== id);
  return [...selected, id];
}

/** "At least three" rule. */
export const canContinue = (selected: string[]) => selected.length >= MIN_TOPIC_COUNT;
