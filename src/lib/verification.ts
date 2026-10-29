/**
 * Email verification seam. The real verifier (Supabase email code, which signs the user in with a
 * JWT session) lives in `src/data/auth.ts`.
 */
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 3;

export interface OtpChallenge {
  expiresAt: number;
  /** Earliest time a new code can be requested. */
  resendAt: number;
}

export type OtpResult =
  | { ok: true }
  | { ok: false; reason: 'wrong' | 'expired' | 'locked' | 'no_code'; attemptsLeft: number };

export interface RequestOptions {
  /** false: only existing accounts may sign in ("Log in"); true: register if new ("Get started"). */
  createUser?: boolean;
}

export interface EmployeeVerifier {
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
