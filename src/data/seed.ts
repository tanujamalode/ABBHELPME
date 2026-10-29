import type { AuthorMeta, Comment, Post, Resource } from './types';

const A = (role: string, experience: string): AuthorMeta => ({ role, experience, verified: true });

const H = 3600_000;

/** Bundled demo content. Always flagged sample:true and never written to the user's tables. */
export function getSamplePosts(now: number = Date.now()): Post[] {
  const base = { sample: true as const, updatedAt: now };
  return [
    {
      ...base, id: 'sample-overwhelmed', kind: 'personal', category: 'Stress & Anxiety', author: null,
      title: 'Feeling overwhelmed lately',
      body: "I've been feeling really anxious and stressed about a lot of things lately. It's affecting my sleep and focus. Has anyone else felt this way?",
      createdAt: now - 2 * H,
    },
    {
      ...base, id: 'sample-transfer', kind: 'work_question', category: 'HR', author: A('engineer', '1to3'),
      title: 'How to apply for internal transfer?',
      body: "Hi, I'm interested in exploring internal opportunities. Can someone guide me on the process and where to start?",
      createdAt: now - 4 * H,
    },
    {
      ...base, id: 'sample-vpn', kind: 'work_question', category: 'IT', author: A('intern', 'lt1'),
      title: 'VPN not working',
      body: 'My VPN disconnects every few minutes when I work from home. Has anyone found a fix?',
      createdAt: now - 6 * H,
    },
    {
      ...base, id: 'sample-stress', kind: 'work_question', category: 'Workplace', author: A('project_manager', '5to10'),
      title: 'How to deal with work stress?',
      body: 'Deadlines are piling up. What helps you stay on top of your workload without burning out?',
      createdAt: now - 9 * H,
    },
    {
      ...base, id: 'sample-ach-safety', kind: 'achievement', category: 'Safety', author: A('operations', '10plus'),
      title: 'Zero-incident month for our line',
      body: 'Our team completed the month with no recordable incidents after refreshing the pre-shift safety walk. Thank you all.',
      createdAt: now - 26 * H,
    },
  ];
}

export const SAMPLE_REACTIONS: Record<string, number> = {
  'sample-overwhelmed': 98, 'sample-transfer': 76, 'sample-vpn': 54, 'sample-stress': 124, 'sample-ach-safety': 41,
};

export function getSampleComments(now: number = Date.now()): Comment[] {
  const base = { sample: true as const, accepted: false };
  return [
    { ...base, id: 'sample-c1', postId: 'sample-transfer', createdAt: now - 1 * H, author: A('senior_engineer', '5to10'),
      body: 'I went through the same process last year. Talk to your manager early, then check the internal job board. Happy to share more.' },
    { ...base, id: 'sample-c2', postId: 'sample-overwhelmed', createdAt: now - 1 * H, author: null,
      body: 'You are not alone in this. Taking short breaks and talking to someone you trust can help.' },
    { ...base, id: 'sample-c3', postId: 'sample-vpn', createdAt: now - 5 * H, author: A('it', '3to5'), accepted: true,
      body: 'This usually happens when the client is set to the wrong gateway. Reinstall from the software centre and pick the nearest region; it fixed it for most of our site.' },
    { ...base, id: 'sample-c4', postId: 'sample-vpn', createdAt: now - 4 * H, author: A('engineer', '1to3'),
      body: 'Restarting the router helped me once, but it came back after a day.' },
    { ...base, id: 'sample-c5', postId: 'sample-stress', createdAt: now - 8 * H, author: A('manager', '10plus'),
      body: 'Write down everything on your plate and agree the top three with your manager each week. It makes the rest negotiable.' },
    { ...base, id: 'sample-c6', postId: 'sample-stress', createdAt: now - 7 * H, author: A('apprentice', 'lt1'),
      body: 'Blocking 30 minutes of focus time in my calendar each morning helps a lot.' },
  ];
}

/** Baseline vote scores for sample answers (demo only). */
export const SAMPLE_COMMENT_SCORES: Record<string, number> = {
  'sample-c1': 23, 'sample-c2': 31, 'sample-c3': 47, 'sample-c4': 3, 'sample-c5': 38, 'sample-c6': 12,
};

/** Demonstration answers only. Not written by, or reviewed by, real HR or IT staff. */
export const SAMPLE_ANSWERS: Record<string, { label: string; body: string }> = {
  'sample-transfer': {
    label: 'Sample verified answer',
    body: 'You can usually find the internal transfer process in your HR portal under career and development. If you need personalised support, reach out to your HR contact. (Demonstration text — not reviewed by real HR staff.)',
  },
  'sample-vpn': {
    label: 'Sample verified answer',
    body: 'Try the steps in your IT support guide, or raise a ticket via your service portal if the problem continues. (Demonstration text — not reviewed by real IT staff.)',
  },
};

/**
 * Bundled resources. Contact fields are intentionally empty: add real,
 * approved ABB details in src/data/resourceConfig.ts. Nothing here is a real
 * ABB contact, helpline or crisis number.
 */
export const SEED_RESOURCES: Resource[] = [
  { id: 'r-wellbeing', group: 'wellbeing', title: 'Mental Well-being Resources', subtitle: 'Articles, videos, and tools',
    body: 'Sample overview of well-being content. Replace with approved material.', verified: false },
  { id: 'r-stress', group: 'wellbeing', title: 'Stress & Anxiety', subtitle: 'Guided exercises, tips, and tools',
    body: 'Sample guidance: short breathing exercises, planning your day, and talking to someone you trust.', verified: false },
  { id: 'r-mindful', group: 'wellbeing', title: 'Mindfulness & Meditation', subtitle: 'Take a break, reset your mind',
    body: 'Sample guidance: a two-minute pause between tasks can help you reset.', verified: false },
  { id: 'r-balance', group: 'wellbeing', title: 'Work-Life Balance', subtitle: 'Tips for a healthier routine',
    body: 'Sample guidance: set clear start and stop times, and protect breaks.', verified: false },
  { id: 'r-eap', group: 'support', title: 'Employee Assistance Program (EAP)', subtitle: 'Counselling & support services',
    body: 'Contact details are not configured in this prototype. Ask HR for the approved EAP route.', verified: false },
  { id: 'r-hr', group: 'hr', title: 'HR Policies', subtitle: 'Leave, benefits, career, more',
    body: 'Sample overview. Link your approved HR policy portal in the resource configuration.', verified: false },
  { id: 'r-it', group: 'it', title: 'IT Support', subtitle: 'Tech help, system access, VPN',
    body: 'Sample overview. Link your approved IT service portal in the resource configuration.', verified: false },
  { id: 'r-workplace', group: 'workplace', title: 'Workplace & Facilities', subtitle: 'Office, safety, transport',
    body: 'Sample overview. Add facilities and accessibility contacts when approved.', verified: false },
  { id: 'r-urgent', group: 'support', title: 'Emergency Contacts', subtitle: 'Urgent help information',
    body: 'No emergency numbers are bundled. If you or someone else is in danger, contact your local emergency services immediately.', verified: false },
  { id: 'r-faq', group: 'faq', title: 'FAQs', subtitle: 'Quick answers to common queries',
    body: 'Sample FAQ index. Replace with approved answers.', verified: false },
  { id: 'r-policy', group: 'policy', title: 'Code of Conduct & Policies', subtitle: 'Where to find company policies',
    body: 'Sample entry. Link the approved policy library.', verified: false },
];
