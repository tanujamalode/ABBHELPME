import { localReply } from '@/lib/assistant';
import type { Resource } from '@/data/types';

const r = (id: string, group: Resource['group'], title: string): Resource => ({ id, group, title, subtitle: '', body: '', verified: false, source: 'ABB', reviewedAt: null });
const SEED_RESOURCES: Resource[] = [
  r('r-stress', 'wellbeing', 'Stress & Anxiety'), r('r-mindful', 'wellbeing', 'Mindfulness & Meditation'),
  r('r-balance', 'wellbeing', 'Work-Life Balance'), r('r-eap', 'support', 'Employee Assistance Program'),
  r('r-urgent', 'support', 'Emergency Contacts'), r('r-hr', 'hr', 'HR Policies'), r('r-it', 'it', 'IT Support'),
  r('r-faq', 'faq', 'FAQs'), r('r-policy', 'policy', 'Code of Conduct & Policies'), r('r-workplace', 'workplace', 'Workplace & Facilities'),
];

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
