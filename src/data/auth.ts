import type { SupabaseClient } from '@supabase/supabase-js';
import { isAllowedEmail } from '@/lib/emailPolicy';
import { OTP_MAX_ATTEMPTS, VerificationError, type EmployeeVerifier, type RequestFailure } from '@/lib/verification';
import { supabase } from './supabaseClient';

/** Supabase defaults: "Email OTP Expiration" 3600 s, and one email per address every 60 s. */
export const EMAIL_OTP_TTL_MS = 60 * 60_000;
export const EMAIL_OTP_RESEND_MS = 60_000;

const failureFor = (e: { status?: number; code?: string }): RequestFailure => {
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit') return 'rate_limited';
  if (e.code === 'otp_disabled' || e.code === 'signup_disabled' || e.code === 'user_not_found') return 'no_account';
  return 'send_failed';
};

/**
 * Real email sign-in. Supabase emails a one-time code; verifying it creates a session whose
 * access token (a JWT) authorises every request to the shared community tables.
 */
export function createEmailVerifier(client: SupabaseClient): EmployeeVerifier {
  let active: { email: string; expiresAt: number; attempts: number } | null = null;
  const key = (e: string) => e.trim().toLowerCase();
  return {
    async requestCode(email, now = Date.now(), opts = {}) {
      const e = key(email);
      if (!isAllowedEmail(e)) throw new VerificationError('domain');
      const { error } = await client.auth.signInWithOtp({ email: e, options: { shouldCreateUser: opts.createUser ?? true } });
      if (error) throw new VerificationError(failureFor(error));
      active = { email: e, expiresAt: now + EMAIL_OTP_TTL_MS, attempts: 0 };
      return { expiresAt: active.expiresAt, resendAt: now + EMAIL_OTP_RESEND_MS };
    },
    async confirmCode(email, code, now = Date.now()) {
      const e = key(email);
      if (!active || active.email !== e) return { ok: false, reason: 'no_code', attemptsLeft: 0 };
      if (now > active.expiresAt) return { ok: false, reason: 'expired', attemptsLeft: 0 };
      if (active.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'locked', attemptsLeft: 0 };
      const { error } = await client.auth.verifyOtp({ email: e, token: code.trim(), type: 'email' });
      if (!error) { active = null; return { ok: true }; }
      active.attempts += 1;
      const attemptsLeft = OTP_MAX_ATTEMPTS - active.attempts;
      return { ok: false, reason: attemptsLeft === 0 ? 'locked' : 'wrong', attemptsLeft };
    },
  };
}

/** Used only when no Supabase project is configured; the app shows a setup screen instead of the sign-in. */
const unavailable: EmployeeVerifier = {
  async requestCode() { throw new VerificationError('send_failed'); },
  async confirmCode() { return { ok: false, reason: 'no_code', attemptsLeft: 0 }; },
};

export const verifier: EmployeeVerifier = supabase ? createEmailVerifier(supabase) : unavailable;

export const verifiedLabel = () => 'Verified email';

/**
 * Test-only sign-in with a password, for dummy accounts you create in the Supabase dashboard
 * (Authentication > Users > Add user, with "Auto Confirm User" ticked), so no email is needed.
 * Off unless EXPO_PUBLIC_DEV_LOGIN=true is in .env. Leave it off for anything real.
 */
export const devLoginEnabled = !!supabase && process.env.EXPO_PUBLIC_DEV_LOGIN === 'true';

export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  if (!supabase || !devLoginEnabled) return false;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return !error;
}
