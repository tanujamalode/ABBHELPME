import { isValidEmail } from './verification';

/**
 * Who may register. Mirrors public.is_member() in the 002_email_auth.sql migration, which enforces
 * the same rule on the server; keep the two in sync.
 */
export const OUTLOOK_DOMAINS = ['outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.in', 'msn.com'] as const;
export const ORG_DOMAIN = 'abb.com';

export const emailDomain = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';

/** Outlook / Hotmail / Live / MSN personal mail, or ABB work mail (including subdomains such as in.abb.com). */
export function isAllowedEmail(email: string): boolean {
  if (!isValidEmail(email)) return false;
  const d = emailDomain(email);
  return (OUTLOOK_DOMAINS as readonly string[]).includes(d) || d === ORG_DOMAIN || d.endsWith(`.${ORG_DOMAIN}`);
}

export const ALLOWED_EMAIL_HINT = 'Outlook, Hotmail, Live or ABB email.';
