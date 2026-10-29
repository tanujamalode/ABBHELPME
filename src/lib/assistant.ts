import type { Resource } from '@/data/types';

/**
 * Help Assistant engine.
 *
 * Runs on the phone: user text is never sent anywhere. It answers by matching keywords
 * against the resources loaded from the database. A backend/AI implementation of `AssistantEngine` (after ABB
 * privacy review) without changing the chat screen.
 */
/** A shortcut to a screen in the app, shown as a button under the reply. */
export interface AssistantAction { label: string; href: string }

export interface AssistantReply {
  text: string;
  /** Resources to show as tappable cards under the reply. */
  resourceIds: string[];
  /** Screens to open: wellbeing activities, people, recognition and so on. */
  actions?: AssistantAction[];
  /** Offer to post the question to Community. */
  suggestCompose?: boolean;
  urgent?: boolean;
}

export interface AssistantEngine {
  reply(message: string, resources: Resource[]): Promise<AssistantReply>;
}

const URGENT = /\b(suicid\w*|kill (my ?self|me)|end (it|my life)|self[- ]?harm|hurt(ing)? (my ?self|me)|want to die|emergency|in danger|not safe|unsafe|abuse[ds]?|overdose)\b/i;
/** Words that suggest someone may be in danger. Used to surface support, never to block a message. */
export const isUrgentText = (text: string) => URGENT.test(text);
const GREETING = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|namaste)\b/i;
const THANKS = /\b(thanks|thank you|thx|cheers)\b/i;

const MEDITATE: AssistantAction = { label: 'Breathe or meditate', href: '/meditate' };
const BREAKS: AssistantAction = { label: 'Take a micro-break', href: '/microbreaks' };
const PEOPLE: AssistantAction = { label: 'People who understand', href: '/people' };

const INTENTS: { pattern: RegExp; ids: string[]; text: string; actions?: AssistantAction[] }[] = [
  { pattern: /\b(stress\w*|anxi\w*|overwhelm\w*|panic\w*|worr\w*|nervous|pressure)\b/i, ids: ['r-stress', 'r-mindful', 'r-eap'],
    actions: [MEDITATE, BREAKS],
    text: "That sounds hard. A few slow breaths can help right now, and talking to someone you trust can make a real difference." },
  { pattern: /\b(sleep\w*|insomnia|can'?t sleep|awake|restless|wind down|relax\w*)\b/i, ids: ['r-mindful'],
    actions: [{ label: 'Sleep & relax session', href: '/meditate' }],
    text: 'A slow, dim relaxation session can help you wind down. Try the Sleep mode.' },
  { pattern: /\b(break|stretch\w*|eyes?|screen|sore|stiff|water|hydrat\w*|thirsty|walk\w*)\b/i, ids: [],
    actions: [BREAKS],
    text: 'A short reset can make a big difference. Pick a micro-break.' },
  { pattern: /\b(lonely|alone|isolated|someone who understands|peer|talk to a colleague|connect with)\b/i, ids: ['r-eap'],
    actions: [PEOPLE, { label: 'My messages', href: '/messages' }],
    text: "You don't have to go through it alone. You can find a colleague who understands, anonymously and only if you both want to." },
  { pattern: /\b(feedback|suggest\w*|complain\w*|idea for abb|improve)\b/i, ids: [],
    actions: [{ label: 'Send anonymous feedback', href: '/feedback' }],
    text: 'You can send feedback to ABB anonymously. Only monthly counts are shared, never who wrote it.' },
  { pattern: /\b(thank\w*|apprecia\w*|recogni\w*|shout[- ]?out|praise|kudos)\b/i, ids: [],
    actions: [{ label: 'Give a shout-out', href: '/recognition' }],
    text: 'Lovely idea. You can give a colleague a shout-out with a badge.' },
  { pattern: /\b(communit\w*|group|join|follow)\b/i, ids: [],
    actions: [{ label: 'Browse communities', href: '/communities' }],
    text: 'Communities bring together people with the same interests. You can follow the ones you like.' },
  { pattern: /\b(progress|journey|history|my check-?ins?)\b/i, ids: [],
    actions: [{ label: 'My Wellbeing Journey', href: '/journey' }],
    text: 'Your journey brings your check-ins, practice and saves together, just for you.' },
  { pattern: /\b(burn ?out|burnt out|exhaust\w*|tired|overtime|work[- ]?life|balance|long hours|weekend)\b/i, ids: ['r-balance', 'r-stress'],
    text: 'Protecting your time and energy matters. Here are some ideas for a healthier routine.' },
  { pattern: /\b(mindful\w*|meditat\w*|breath\w*|relax\w*|calm)\b/i, ids: ['r-mindful', 'r-wellbeing'],
    text: 'A short pause can help you reset. Try one of these.' },
  { pattern: /\b(counsel\w*|therap\w*|talk to (someone|somebody)|someone to talk|lonely|sad|down|depress\w*|eap)\b/i, ids: ['r-eap', 'r-wellbeing'],
    text: "You don't have to handle this alone. The Employee Assistance Program is a confidential place to start." },
  { pattern: /\b(leave|holiday|vacation|benefit\w*|salary|pay(roll|slip)?|bonus|insurance|maternity|paternity|hr)\b/i, ids: ['r-hr', 'r-policy'],
    text: 'HR policies cover leave, pay and benefits. Your HR team can confirm what applies to you.' },
  { pattern: /\b(vpn|laptop|password|login|log in|access|account|email|outlook|teams|software|printer|wifi|wi-fi|it)\b/i, ids: ['r-it'],
    text: 'IT Support handles tools, access and devices. Here is where to start.' },
  { pattern: /\b(office|desk|parking|transport|canteen|facilit\w*|accessib\w*|building|safety|ppe)\b/i, ids: ['r-workplace'],
    text: 'Workplace & Facilities covers the office, transport, safety and accessibility.' },
  { pattern: /\b(manager|team|conflict|colleague|feedback|bully\w*|harass\w*|conduct|discriminat\w*|policy|policies)\b/i, ids: ['r-policy', 'r-hr'],
    text: 'Company policies explain how concerns like this are handled. HR can guide you on the right route.' },
  { pattern: /\b(career|promotion|learn\w*|training|course|skill\w*|grow\w*)\b/i, ids: ['r-hr'],
    text: 'Career and learning options usually sit with HR. You could also ask the Community how others approached it.' },
];

/** Pure, synchronous matching: easy to test. */
export function localReply(message: string, resources: Resource[]): AssistantReply {
  const known = new Set(resources.map((r) => r.id));
  const keep = (ids: string[]) => ids.filter((id) => known.has(id));
  const msg = message.trim();

  if (URGENT.test(msg)) {
    return {
      urgent: true,
      text: 'If you or someone else is in danger or might act on thoughts of harm, please contact your local emergency services now. ' +
        "This assistant can't call anyone or alert anybody, and the app is not monitored.",
      resourceIds: keep(['r-urgent', 'r-eap']),
    };
  }
  if (!msg) return { text: 'Type a question and I will point you to the right place.', resourceIds: [] };
  if (THANKS.test(msg) && msg.length < 40) return { text: "You're welcome. I'm here whenever you need me.", resourceIds: [] };
  if (GREETING.test(msg) && msg.split(/\s+/).length <= 4) {
    return { text: 'Hi! Tell me what you need help with — for example stress, leave, IT access or the office.', resourceIds: [] };
  }

  const hits = INTENTS.filter((i) => i.pattern.test(msg));
  if (hits.length) {
    const ids = keep([...new Set(hits.flatMap((h) => h.ids))]).slice(0, 3);
    const actions = hits.flatMap((h) => h.actions ?? []).filter((a, i, all) => all.findIndex((b) => b.href === a.href && b.label === a.label) === i).slice(0, 3);
    return { text: hits[0].text, resourceIds: ids, actions, suggestCompose: true };
  }

  // Fall back to a plain text search over resource titles and subtitles.
  const words = msg.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const found = resources.filter((r) => words.some((w) => `${r.title} ${r.subtitle}`.toLowerCase().includes(w))).map((r) => r.id);
  if (found.length) return { text: 'These resources look related:', resourceIds: found.slice(0, 3), suggestCompose: true };

  return {
    text: "I couldn't find a resource for that yet. You can write it down as a question in Community, or browse all resources.",
    resourceIds: keep(['r-faq']),
    suggestCompose: true,
  };
}

export const localAssistant: AssistantEngine = {
  reply: async (message, resources) => localReply(message, resources),
};

export const STARTER_PROMPTS = [
  "I'm feeling stressed",
  "I can't sleep",
  'I need someone to talk to',
  'How do I request leave?',
];
