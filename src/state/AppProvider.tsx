import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import type { Session } from '@supabase/supabase-js';
import type { Repository } from '@/data/repository';
import { MemoryRepository } from '@/data/memoryRepository';
import { SupabaseRepository } from '@/data/supabaseRepository';
import { supabase } from '@/data/supabaseClient';
import type { NewProfileInput, Profile, ProfilePatch } from '@/data/types';
import { syncReminders } from '@/lib/reminders';

/** `unconfigured`: EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are missing, so there is no backend to talk to. */
type Status = 'loading' | 'ready' | 'error' | 'unconfigured';

export interface Account { id: string; email: string }

/** What happened after the email code was accepted. */
export type SignInResult = 'ready' | 'needs_profile';

interface AppState {
  repo: Repository;
  status: Status;
  error: string | null;
  profile: Profile | null;
  /** The signed-in account. */
  account: Account | null;
  /** A valid session exists. */
  signedIn: boolean;
  /** Past the email code and, if the profile asks for it, the device lock. */
  unlocked: boolean;
  /** Bumps whenever data changes so screens can refresh. */
  version: number;
  bump(): void;
  retry(): void;
  /** Call once the email code is accepted. */
  finishSignIn(): Promise<SignInResult>;
  createProfile(input: NewProfileInput): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  unlock(): Promise<{ ok: boolean; message?: string }>;
  completeOnboarding(topicIds: string[]): Promise<void>;
  /** Ends the session on this device. Nothing is deleted. */
  signOut(): Promise<void>;
  /** Deletes the account and everything stored for it. */
  deleteAccount(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

const toAccount = (s: Session | null): Account | null => (s ? { id: s.user.id, email: s.user.email ?? '' } : null);

export function AppProvider({ children, repository }: { children: React.ReactNode; repository?: Repository }) {
  const [repo] = useState<Repository>(() =>
    repository ?? (supabase ? new SupabaseRepository(supabase) : new MemoryRepository()));
  const configured = !!repository || !!supabase;

  const [status, setStatus] = useState<Status>(configured ? 'loading' : 'unconfigured');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const account = toAccount(session);
  const signedIn = !!session;
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    (async () => {
      try {
        await repo.init();
        const s = supabase ? (await supabase.auth.getSession()).data.session : null;
        const p = s || !supabase ? await repo.getProfile() : null;
        if (!alive) return;
        setSession(s);
        setProfile(p);
        // A profile that opted out of the device lock opens straight away; otherwise Welcome asks to unlock.
        if (s && p && !p.lockEnabled) setUnlocked(true);
        setError(null);
        setStatus('ready');
      } catch {
        if (!alive) return;
        setError('Could not reach the server. Check your internet connection and try again.');
        setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [repo, attempt, configured]);

  // Once the app is open, make sure this phone's reminders match the saved preferences (e.g. after a reinstall).
  useEffect(() => {
    if (!unlocked) return;
    repo.getNotificationPrefs().then((p) => syncReminders(p)).catch(() => { /* reminders are best effort */ });
  }, [unlocked, repo]);

  // Session changes from anywhere (sign-in, token refresh, sign-out, expired refresh token) re-gate navigation.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) { setProfile(null); setUnlocked(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const finishSignIn = useCallback(async (): Promise<SignInResult> => {
    if (supabase) {
      const s = (await supabase.auth.getSession()).data.session;
      if (!s) throw new Error('Not signed in');
      setSession(s);
    }
    const p = await repo.getProfile();
    if (!p) return 'needs_profile';
    setProfile(p);
    setUnlocked(true); // the email code just proved who this is
    bump();
    return 'ready';
  }, [repo, bump]);

  const createProfile = useCallback(async (input: NewProfileInput) => {
    const p = await repo.createProfile({ ...input, displayName: input.displayName || 'there' });
    setProfile(p);
    setUnlocked(true);
    bump();
  }, [repo, bump]);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const p = await repo.updateProfile(patch);
    if (p) setProfile(p);
    bump();
  }, [repo, bump]);

  const unlock = useCallback(async () => {
    if (!profile) return { ok: false, message: 'Sign in first.' };
    if (profile.lockEnabled) {
      try {
        const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
        if (hw && enrolled) {
          const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ABB HELP ME', cancelLabel: 'Cancel' });
          if (!r.success) return { ok: false, message: 'Unlock was cancelled or did not succeed. Please try again.' };
        }
        // No device lock available: allow entry (the signed-in session already proves who this is).
      } catch {
        return { ok: false, message: 'Device authentication is unavailable right now. Please try again.' };
      }
    }
    setUnlocked(true);
    return { ok: true };
  }, [profile]);

  const completeOnboarding = useCallback(async (topicIds: string[]) => {
    await repo.saveSelectedTopicIds(topicIds);
    await repo.setOnboardingComplete();
    setProfile(await repo.getProfile());
    bump();
  }, [repo, bump]);

  const signOut = useCallback(async () => {
    setUnlocked(false);
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setProfile(null);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    await repo.deleteAccount();
    setSession(null);
    setProfile(null);
    setUnlocked(false);
    bump();
  }, [repo, bump]);

  const value = useMemo<AppState>(() => ({
    repo, status, error, profile, account, signedIn, unlocked, version, bump,
    retry: () => { setStatus('loading'); setAttempt((a) => a + 1); },
    finishSignIn, createProfile, updateProfile, unlock, completeOnboarding, signOut, deleteAccount,
  }), [repo, status, error, profile, account, signedIn, unlocked, version, bump,
    finishSignIn, createProfile, updateProfile, unlock, completeOnboarding, signOut, deleteAccount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
