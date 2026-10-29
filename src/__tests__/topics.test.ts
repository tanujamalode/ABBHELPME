import { MIN_TOPIC_COUNT, TOPIC_CATALOGUE, canContinue, toggleTopic } from '@/lib/topics';

describe('minimum-three topic rule', () => {
  const ids = TOPIC_CATALOGUE.map((t) => t.id);

  it('offers twelve topics and requires at least three', () => {
    expect(ids).toHaveLength(12);
    expect(MIN_TOPIC_COUNT).toBe(3);
  });

  it('cannot continue until three are selected', () => {
    let sel: string[] = [];
    for (let i = 0; i < 2; i++) sel = toggleTopic(sel, ids[i]);
    expect(canContinue(sel)).toBe(false);
    sel = toggleTopic(sel, ids[2]);
    expect(canContinue(sel)).toBe(true);
  });

  it('allows selecting every topic', () => {
    let sel: string[] = [];
    for (const id of ids) sel = toggleTopic(sel, id);
    expect(sel).toHaveLength(ids.length);
    expect(canContinue(sel)).toBe(true);
  });

  it('deselecting below three blocks continuing again', () => {
    let sel: string[] = [];
    for (let i = 0; i < 3; i++) sel = toggleTopic(sel, ids[i]);
    sel = toggleTopic(sel, ids[0]);
    expect(sel).toHaveLength(2);
    expect(canContinue(sel)).toBe(false);
  });
});
