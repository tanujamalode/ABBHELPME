/**
 * Content moderation, layer 1: an on-device check that runs before anything is saved.
 * It never sends text anywhere. It warns the writer so they can edit; it does not punish.
 *
 * Layer 2 (Phase 2) is a server-side AI classifier implementing `ModerationService`,
 * with a human review queue and appeals. It plugs in here without UI changes.
 */
export type IssueKind =
  | 'email' | 'phone' | 'employee_id' | 'named_person' | 'confidential' | 'profanity' | 'personal_attack' | 'self_harm';

export interface ModerationIssue {
  kind: IssueKind;
  /** block: must edit before posting. warn: can post anyway. support: show help, never blocks. */
  severity: 'block' | 'warn' | 'support';
  title: string;
  detail: string;
}

export interface ModerationResult {
  ok: boolean;
  issues: ModerationIssue[];
}

export interface ModerationService {
  check(text: string, context: { kind: 'post' | 'comment' }): Promise<ModerationResult>;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMPLOYEE_ID = /\b(emp(loyee)?\s*(id|no|number|#)\s*[:#]?\s*\w+|\b[A-Z]{2}\d{5,}\b)/i;
const NAMED_PERSON = /\b(my|our|the)\s+(manager|boss|lead|supervisor|colleague|teammate|coworker|co-worker|hr partner)\s+(is\s+)?([A-Z][a-z]{2,})\b/;
const MENTION = /(^|\s)@[A-Za-z][\w.]{2,}/;
const CONFIDENTIAL = /\b(confidential|internal only|strictly private|under nda|nda|do not share|not for distribution|password\s*[:=]|trade secret|unreleased)\b/i;
const PROFANITY = /\b(f+u+c+k\w*|sh[i1]t\w*|bitch\w*|bastard\w*|asshole\w*|dick(head)?|crap)\b/i;
const ATTACK = /\b(you('re| are)|he('s| is)|she('s| is)|they('re| are)|manager is|boss is)\s+(an?\s+)?(idiot|stupid|moron|useless|incompetent|pathetic|loser|dumb)\b/i;
const SELF_HARM = /\b(suicid\w*|kill (my ?self|me)|end (it all|my life)|self[- ]?harm|hurt(ing)? my ?self|want to die|no reason to live)\b/i;

/** Pure function so it can be unit-tested and reused by the server later. */
export function checkContent(text: string): ModerationResult {
  const t = text ?? '';
  const issues: ModerationIssue[] = [];
  if (SELF_HARM.test(t)) {
    issues.push({ kind: 'self_harm', severity: 'support', title: "You don't have to carry this alone",
      detail: 'If you might act on thoughts of harming yourself, please contact your local emergency services now. Support options are listed in Resources.' });
  }
  if (ATTACK.test(t)) {
    issues.push({ kind: 'personal_attack', severity: 'block', title: 'Personal attack',
      detail: 'Describe the situation and its impact rather than labelling a person. Posts that insult people are not allowed.' });
  }
  if (PROFANITY.test(t)) {
    issues.push({ kind: 'profanity', severity: 'warn', title: 'Strong language',
      detail: 'Consider rephrasing — respectful posts get more helpful answers.' });
  }
  if (NAMED_PERSON.test(t) || MENTION.test(t)) {
    issues.push({ kind: 'named_person', severity: 'warn', title: 'Mentions a specific person',
      detail: 'Avoid naming colleagues. Describe roles instead (e.g. "my manager") to protect everyone, including you.' });
  }
  if (EMAIL.test(t)) {
    issues.push({ kind: 'email', severity: 'warn', title: 'Contains an email address', detail: 'Email addresses can identify you or others. Remove it unless it is a public team mailbox.' });
  }
  if (PHONE.test(t)) {
    issues.push({ kind: 'phone', severity: 'warn', title: 'Contains a phone number', detail: 'Phone numbers can identify you or others. Consider removing it.' });
  }
  if (EMPLOYEE_ID.test(t)) {
    issues.push({ kind: 'employee_id', severity: 'warn', title: 'Looks like an employee ID', detail: 'IDs can identify a person. Please remove it.' });
  }
  if (CONFIDENTIAL.test(t)) {
    issues.push({ kind: 'confidential', severity: 'block', title: 'May contain confidential information',
      detail: 'Do not post confidential, NDA or internal-only details, or passwords. Please remove them.' });
  }
  return { ok: !issues.some((i) => i.severity === 'block'), issues };
}

export const localModeration: ModerationService = {
  check: async (text) => checkContent(text),
};
