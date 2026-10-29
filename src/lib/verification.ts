/**
 * Email verification seam.
 *
 * `createDemoVerifier` is a MOCK one-time-code flow used when no Supabase project is configured:
 * no email is sent and the code is fixed, so the UI must say so while `isDemo` is true
 * ("Verified · demo", and the demo code is shown on the code screen).
 *
 * The real verifier (Supabase email code, which signs the user in with a JWT session) lives in
 * `src/data/auth.ts`, which also picks the verifier the app uses.
 */
export interface VerificationResult {
  verified: boolean;
  method: 'demo' | 'sso' | 'email_otp';
}

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 30_000;
export const OTP_MAX_ATTEMPTS = 3;

export interface OtpChallenge {
  expiresAt: number;
  /** Earliest time a new code can be requested. */
  resendAt: number;
  /** Only set by the demo verifier, so testers can proceed without an inbox. */
  demoCode?: string;
}

export type OtpResult =
  | { ok: true }
  | { ok: false; reason: 'wrong' | 'expired' | 'locked' | 'no_code'; attemptsLeft: number };

export interface RequestOptions {
  /** false: only existing accounts may sign in ("Log in"); true: register if new ("Get started"). */
  createUser?: boolean;
}

export interface EmployeeVerifier {
  readonly isDemo: boolean;
  /** Send a code to the email. Throws VerificationError when it can't. */
  requestCode(email: string, now?: number, opts?: RequestOptions): Promise<OtpChallenge>;
  confirmCode(email: string, code: string, now?: number): Promise<OtpResult>;
}

export type RequestFailure = 'domain' | 'no_account' | 'rate_limited' | 'send_failed';

export class VerificationError extends Error {
  constructor(readonly reason: RequestFailure) { super(reason); }
}

export const REQUEST_FAILURE_TEXT: Record<RequestFailure, string> = {
  domain: 'Use an Outlook, Hotmail, Live or ABB email address.',
  no_account: 'No account uses this email yet. Choose "Create an account" instead.',
  rate_limited: 'Too many codes were requested. Please wait a few minutes and try again.',
  send_failed: 'Could not send a code. Check your connection and try again.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (email: string) => EMAIL.test(email.trim());

export const DEMO_CODE = '123456';

/** Mock verifier. State lives in memory only; nothing is persisted or sent. */
export function createDemoVerifier(): EmployeeVerifier {
  let active: { email: string; expiresAt: number; attempts: number } | null = null;
  const key = (e: string) => e.trim().toLowerCase();
  return {
    isDemo: true,
    async requestCode(email, now = Date.now()) {
      active = { email: key(email), expiresAt: now + OTP_TTL_MS, attempts: 0 };
      return { expiresAt: active.expiresAt, resendAt: now + OTP_RESEND_MS, demoCode: DEMO_CODE };
    },
    async confirmCode(email, code, now = Date.now()) {
      if (!active || active.email !== key(email)) return { ok: false, reason: 'no_code', attemptsLeft: 0 };
      if (now > active.expiresAt) return { ok: false, reason: 'expired', attemptsLeft: 0 };
      if (active.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'locked', attemptsLeft: 0 };
      if (code.trim() === DEMO_CODE) { active = null; return { ok: true }; }
      active.attempts += 1;
      const attemptsLeft = OTP_MAX_ATTEMPTS - active.attempts;
      return { ok: false, reason: attemptsLeft === 0 ? 'locked' : 'wrong', attemptsLeft };
    },
  };
}
