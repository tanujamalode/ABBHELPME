/** The seven support categories chosen on first launch. They personalise the feed, resources and suggestions. */
export const MIN_TOPIC_COUNT = 1;

export const TOPIC_CATALOGUE = [
  { id: 'mental', label: 'Mental wellbeing' },
  { id: 'workplace', label: 'Workplace concerns' },
  { id: 'relationships', label: 'Relationships and communication' },
  { id: 'career', label: 'Career growth' },
  { id: 'team', label: 'Team and collaboration' },
  { id: 'personal', label: 'Personal wellbeing' },
  { id: 'questions', label: 'Workplace questions' },
] as const;

export type TopicId = (typeof TOPIC_CATALOGUE)[number]['id'];

/** Select or deselect a topic. There is no upper limit; any number may be chosen. */
export function toggleTopic(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((t) => t !== id);
  return [...selected, id];
}

/** At least one category must be chosen. */
export const canContinue = (selected: string[]) => selected.length >= MIN_TOPIC_COUNT;
