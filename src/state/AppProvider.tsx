import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { Session, User } from '@supabase/supabase-js';
import { DEMO_MODE } from '@/constants/demo';
import type { Repository } from '@/data/repository';
import { seedDemoData } from '@/lib/demoData';
import { MemoryRepository } from '@/data/memoryRepository';
import { SqliteRepository } from '@/data/sqliteRepository';
import { CloudRepository } from '@/data/cloudRepository';
import { clearDeviceOwner, getDeviceOwner, setDeviceOwner } from '@/data/owner';
import { supabase } from '@/data/supabaseClient';
import type { NewProfileInput, Profile, ProfilePatch } from '@/data/types';

type Status = 'loading' | 'ready' | 'error';

export interface Account { id: string; email: string }

/** What happened after the email code was accepted. */
export type SignInResult = 'ready' | 'needs_profile' | 'other_account';

interface AppState {
  repo: Repository;
  status: Status;
  error: string | null;
  profile: Profile | null;
  /** The signed-in account (cloud), or the verified demo email (no cloud). */
  account: Account | null;
  /** Cloud: a valid session exists. Demo: verified this run, or a local profile already exists. */
  signedIn: boolean;
  /** A Supabase project is configured: real email sign-in and the shared community. */
  cloud: boolean;
  unlocked: boolean;
  /** Bumps whenever local data changes so screens can refresh. */
  version: number;
  persistent: boolean;
  bump(): void;
  retry(): void;
  /** Call once the email code is accepted. */
  finishSignIn(email: string): Promise<SignInResult>;
  createProfile(input: NewProfileInput): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  unlock(): Promise<{ ok: boolean; message?: string }>;
  completeOnboarding(topicIds: string[]): Promise<void>;
  /** Ends the session. Private data stays on the device, tied to this account. */
  signOut(): Promise<void>;
  /** Removes another account's private data from this device so a new account can use it. */
  replaceDeviceData(): Promise<void>;
  /** Cloud and signed in: deletes the account and its shared content too. Always wipes this device. */
  deleteAllLocalData(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

const toAccount = (s: Session | null): Account | null => (s ? { id: s.user.id, email: s.user.email ?? '' } : null);

/** Saved with the account (never shown to others) so signing in on a new device restores the profile. */
type AccountMeta = { display_name?: string; role?: string | null; experience?: string | null };

export function AppProvider({ children, repository }: { children: React.ReactNode; repository?: Repository }) {
  // Encrypted SQLite on devices. Web preview has no SQLCipher, so it uses a non-persistent in-memory store.
  const persistent = !repository && Platform.OS !== 'web';
  // With a Supabase project configured (EXPO_PUBLIC_SUPABASE_*), shared community content goes to the cloud
  // while private data (profile, mood, notes, bookmarks) stays in the local store.
  const cloud = !repository && !!supabase;
  const [{ local, repo }] = useState(() => {
    if (repository) return { local: repository, repo: repository };
    const store: Repository = persistent ? new SqliteRepository() : new MemoryRepository();
    return { local: store, repo: supabase ? new CloudRepository(store, supabase) : store };
  });

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [demoAccount, setDemoAccount] = useState<Account | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const account = cloud ? toAccount(session) : demoAccount;
  const signedIn = cloud ? !!session : !!demoAccount || !!profile;

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const saveAccountMeta = useCallback((p: Profile) => {
    if (!cloud || !supabase) return;
    const data: AccountMeta = { display_name: p.displayName, role: p.role, experience: p.experience };
    supabase.auth.updateUser({ data }).catch(() => { /* best effort: the profile still exists on this device */ });
  }, [cloud]);

  /** Signed in on a device with no profile (new phone, reinstall, web reload): rebuild it from the account. */
  const restoreProfile = useCallback(async (user: User): Promise<Profile | null> => {
    const m = (user.user_metadata ?? {}) as AccountMeta;
    if (!m.role || !m.experience) return null;
    const p = await repo.createProfile({ displayName: m.display_name || 'there', lockEnabled: true, role: m.role, experience: m.experience });
    await setDeviceOwner(user.id);
    return p;
  }, [repo]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await repo.init();
        let p = await repo.getProfile();
        let s: Session | null = null;
        if (cloud && supabase) {
          s = (await supabase.auth.getSession()).data.session;
          if (s && !p) p = await restoreProfile(s.user);
        }
        if (!alive) return;
        setSession(s);
        setProfile(p);
        setStatus('ready');
      } catch {
        if (!alive) return;
        // Deliberately generic: never surface keys or stored content.
        setError('Secure local storage could not be opened on this device.');
        setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [repo, attempt, cloud, restoreProfile]);

  // Session changes from anywhere (sign-in, token refresh, sign-out, expired refresh token) re-gate navigation.
  useEffect(() => {
    if (!cloud || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setUnlocked(false);
    });
    return () => data.subscription.unsubscribe();
  }, [cloud]);

  const finishSignIn = useCallback(async (email: string): Promise<SignInResult> => {
    let id: string;
    let user: User | null = null;
    if (cloud && supabase) {
      const s = (await supabase.auth.getSession()).data.session;
      if (!s) throw new Error('Not signed in');
      setSession(s);
      id = s.user.id;
      user = s.user;
    } else {
      id = `demo:${email.trim().toLowerCase()}`;
      setDemoAccount({ id, email: email.trim() });
    }
    const [owner, existing] = await Promise.all([getDeviceOwner(), repo.getProfile()]);
    if (existing && owner && owner !== id) return 'other_account';
    let p = existing;
    if (p) { if (!owner) await setDeviceOwner(id); }
    else if (user) p = await restoreProfile(user);
    if (!p) return 'needs_profile';
    setProfile(p);
    setUnlocked(true); // the email code just proved who this is
    bump();
    return 'ready';
  }, [cloud, repo, restoreProfile, bump]);

  const createProfile = useCallback(async (input: NewProfileInput) => {
    const p = await repo.createProfile({ ...input, displayName: input.displayName || 'there' });
    if (account) await setDeviceOwner(account.id);
    saveAccountMeta(p);
    setProfile(p);
    setUnlocked(true);
    bump();
  }, [repo, account, saveAccountMeta, bump]);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const p = await repo.updateProfile(patch);
    if (p) { setProfile(p); saveAccountMeta(p); }
    bump();
  }, [repo, saveAccountMeta, bump]);

  const unlock = useCallback(async () => {
    if (!profile) return { ok: false, message: 'No profile on this device yet.' };
    if (profile.lockEnabled) {
      try {
        const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
        if (hw && enrolled) {
          const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ABB HELP ME', cancelLabel: 'Cancel' });
          if (!r.success) return { ok: false, message: 'Unlock was cancelled or did not succeed. Please try again.' };
        }
        // No device lock available: allow entry (no password is stored by this app).
      } catch {
        return { ok: false, message: 'Device authentication is unavailable right now. Please try again.' };
      }
    }
    setUnlocked(true);
    return { ok: true };
  }, [profile]);

  const completeOnboarding = useCallback(async (topicIds: string[]) => {
    await repo.saveSelectedTopicIds(topicIds);
    if (DEMO_MODE) await seedDemoData(repo);
    await repo.setOnboardingComplete();
    setProfile(await repo.getProfile());
    bump();
  }, [repo, bump]);

  const reopen = useCallback(() => {
    setProfile(null);
    setUnlocked(false);
    bump();
    setStatus('loading');
    setAttempt((a) => a + 1); // re-open a fresh, empty store
  }, [bump]);

  const signOut = useCallback(async () => {
    setUnlocked(false);
    setDemoAccount(null);
    if (cloud && supabase) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
    }
  }, [cloud]);

  const replaceDeviceData = useCallback(async () => {
    await local.deleteAllLocalData();
    await clearDeviceOwner();
    reopen();
  }, [local, reopen]);

  const deleteAllLocalData = useCallback(async () => {
    await repo.deleteAllLocalData();
    await clearDeviceOwner();
    setSession(null);
    setDemoAccount(null);
    reopen();
  }, [repo, reopen]);

  const value = useMemo<AppState>(() => ({
    repo, status, error, profile, account, signedIn, cloud, unlocked, version, persistent, bump,
    retry: () => { setStatus('loading'); setAttempt((a) => a + 1); },
    finishSignIn, createProfile, updateProfile, unlock, completeOnboarding, signOut, replaceDeviceData, deleteAllLocalData,
  }), [repo, status, error, profile, account, signedIn, cloud, unlocked, version, persistent, bump,
    finishSignIn, createProfile, updateProfile, unlock, completeOnboarding, signOut, replaceDeviceData, deleteAllLocalData]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
