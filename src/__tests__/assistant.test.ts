import { localReply } from '@/lib/assistant';
import { SEED_RESOURCES } from '@/data/seed';

describe('local Help Assistant', () => {
  it('routes urgent messages to emergency info first', () => {
    const r = localReply('I want to hurt myself', SEED_RESOURCES);
    expect(r.urgent).toBe(true);
    expect(r.resourceIds[0]).toBe('r-urgent');
  });

  it('matches common intents to bundled resources', () => {
    expect(localReply("I'm so stressed about deadlines", SEED_RESOURCES).resourceIds).toContain('r-stress');
    expect(localReply('My VPN password expired', SEED_RESOURCES).resourceIds).toEqual(['r-it']);
    expect(localReply('How many days of leave do I get?', SEED_RESOURCES).resourceIds).toContain('r-hr');
  });

  it('only returns resource ids that exist', () => {
    const r = localReply('stressed', []);
    expect(r.resourceIds).toEqual([]);
  });

  it('falls back gracefully and offers Community', () => {
    const r = localReply('zzz qqq', SEED_RESOURCES);
    expect(r.urgent).toBeFalsy();
    expect(r.suggestCompose).toBe(true);
  });
});
