import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { confirmDeleteData, confirmSignOut } from '@/components/accountActions';
import { Capy, CapySays } from '@/components/Capy';
import { OtpStep } from '@/components/OtpStep';
import { Select } from '@/components/Select';
import { Badge, BrandMark, Button, Field, Text } from '@/components/ui';
import { accents, colors, radius, shadow, space } from '@/constants/brand';
import { verifiedLabel, verifier } from '@/data/auth';
import { outfitForRole } from '@/lib/capy';
import { ALLOWED_EMAIL_HINT, isAllowedEmail } from '@/lib/emailPolicy';
import { EXPERIENCE_OPTIONS, ROLE_OPTIONS, roleLabel } from '@/lib/profileOptions';
import { REQUEST_FAILURE_TEXT, VerificationError, isValidEmail, type OtpChallenge } from '@/lib/verification';
import { useApp } from '@/state/AppProvider';

/** landing → email → code → details (only for a new account without a saved profile). */
type Mode = 'landing' | 'email' | 'code' | 'details';
type Intent = 'register' | 'login';
const STEP: Record<Exclude<Mode, 'landing'>, number> = { email: 1, code: 2, details: 3 };

export default function Welcome() {
  const {
    profile, account, signedIn, cloud, persistent,
    finishSignIn, createProfile, unlock, signOut, replaceDeviceData, deleteAllLocalData,
  } = useApp();
  // Signed in but no profile yet (e.g. the app was closed mid-registration): continue at the details step.
  const [mode, setMode] = useState<Mode>(() => (account && !profile ? 'details' : 'landing'));
  const [intent, setIntent] = useState<Intent>('register');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [lock, setLock] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = isAllowedEmail(email);

  const goBack = useCallback(() => {
    setError(null);
    if (mode === 'code') setMode('email');
    else if (mode === 'details') { void signOut(); setMode('landing'); } // cancel registration
    else setMode('landing');
  }, [mode, signOut]);

  // Android back steps through the flow instead of closing the app.
  useEffect(() => {
    if (mode === 'landing') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => sub.remove();
  }, [mode, goBack]);

  const start = (i: Intent) => { setIntent(i); setError(null); setMissing(false); setMode('email'); };

  const sendCode = async () => {
    if (!emailOk) { setMissing(true); return; }
    setBusy(true); setError(null);
    try {
      setChallenge(await verifier.requestCode(email, undefined, { createUser: intent === 'register' }));
      setMode('code');
    } catch (e) {
      setError(REQUEST_FAILURE_TEXT[e instanceof VerificationError ? e.reason : 'send_failed']);
    }
    setBusy(false);
  };

  const confirmReplace = () => Alert.alert(
    'Another account used this device',
    'This device holds private data (mood check-ins, notes, saved items) from a different account. To continue, it will be removed from this device. Shared community posts are not affected.',
    [
      { text: 'Cancel', style: 'cancel', onPress: () => { void signOut(); setMode('landing'); } },
      { text: 'Remove and continue', style: 'destructive', onPress: () => { void replaceDeviceData(); } },
    ]);

  /** Code accepted: the session (JWT) exists now. */
  const onVerified = async () => {
    try {
      const r = await finishSignIn(email);
      if (r === 'needs_profile') setMode('details');
      else if (r === 'other_account') confirmReplace();
      // 'ready': navigation moves on by itself.
    } catch {
      setError('Could not finish signing in. Please try again.');
      setMode('email');
    }
  };

  const onCreate = async () => {
    if (name.trim().length > 30) { setError('Please keep your name within 30 characters.'); return; }
    if (!role || !experience) { setMissing(true); return; }
    setBusy(true); setError(null);
    try {
      await createProfile({ displayName: name.trim(), lockEnabled: lock, role, experience });
    } catch {
      setError('Could not create your profile. Please try again.');
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    setBusy(true); setError(null);
    const r = await unlock();
    if (!r.ok) setError(r.message ?? 'Could not unlock.');
    setBusy(false);
  };

  // Capy reacts to the form: waves first, then dresses for the chosen role.
  const firstName = name.trim();
  const capyLine = role
    ? { pose: outfitForRole(role), text: `Nice to meet you${firstName ? `, ${firstName}` : ''}! ${role === 'other' ? '' : `A fellow ${roleLabel(role)}.`}`.trim() }
    : { pose: 'hi' as const, text: firstName ? `Hi ${firstName}! What do you do at ABB?` : "You're in! Tell me a little about your work." };

  const steps = intent === 'register' || mode === 'details' ? 3 : 2;
  const emailError = missing && !emailOk
    ? (isValidEmail(email) ? REQUEST_FAILURE_TEXT.domain : 'Enter a valid email address.')
    : error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {mode !== 'landing' ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
                <Button label={mode === 'details' ? 'Cancel' : 'Back'} variant="ghost" icon="chevron-back" onPress={goBack}
                  style={{ paddingHorizontal: 0 }} />
                <View style={{ flex: 1 }} />
                <Text variant="label" style={{ color: colors.red, letterSpacing: 1 }}>STEP {STEP[mode]} OF {steps}</Text>
              </View>

              {mode === 'email' ? (
                <View>
                  <CapySays pose="hi" message={intent === 'register' ? "Hi! I'm Capy. Let's set you up." : 'Welcome back! Which email do you use?'}
                    size={96} motion="pop" tint={colors.bg} />
                  <Text variant="title" accessibilityRole="header" style={{ marginTop: space.xl, marginBottom: space.xs }}>
                    {intent === 'register' ? 'Create your account' : 'Log in'}
                  </Text>
                  <Text variant="small" style={{ marginBottom: space.lg }}>
                    {verifier.isDemo
                      ? 'Prototype: no email is sent. You will get a demo code on the next screen.'
                      : "We'll email you a 6-digit code. No password needed."}
                  </Text>
                  <Field label="Email" value={email} onChangeText={(t) => { setEmail(t); setMissing(false); setError(null); }}
                    placeholder="you@outlook.com or you@abb.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    textContentType="emailAddress" autoComplete="email" returnKeyType="send" onSubmitEditing={sendCode}
                    error={emailError} hint={`${ALLOWED_EMAIL_HINT} It's never shown on your posts.`} />
                  <Button label="Send code" icon="mail-outline" onPress={sendCode} loading={busy} />
                  <Text variant="small" style={{ textAlign: 'center', marginTop: space.lg }}>
                    {intent === 'register' ? 'Already have an account? ' : 'New here? '}
                    <Text variant="small" style={styles.link} accessibilityRole="button"
                      onPress={() => start(intent === 'register' ? 'login' : 'register')}>
                      {intent === 'register' ? 'Log in' : 'Create an account'}
                    </Text>
                  </Text>
                </View>
              ) : null}

              {mode === 'code' && challenge ? (
                <OtpStep email={email.trim()} challenge={challenge} createUser={intent === 'register'} onChallenge={setChallenge}
                  onVerified={onVerified} onChangeEmail={() => { setMode('email'); setError(null); }} />
              ) : null}

              {mode === 'details' ? (
                <View>
                  <CapySays pose={capyLine.pose} message={capyLine.text} size={role ? 120 : 96} motion="pop" tint={colors.bg} />
                  <Text variant="title" accessibilityRole="header" style={{ marginTop: space.xl, marginBottom: space.xs }}>Set up your profile</Text>
                  <View style={styles.verifyRow}>
                    <Badge label={verifiedLabel()} tone="ok" />
                    <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>
                      {account?.email ? `Signed in as ${account.email}` : 'Email verified.'}
                    </Text>
                  </View>
                  <Field label="What should we call you? (optional)" value={name} onChangeText={setName}
                    placeholder="First name or nickname" maxLength={40} autoCapitalize="words"
                    hint="Only shown to you. Posts never show your name or email." />
                  <Select label="Your role" placeholder="Choose your role" value={role} onChange={(v) => { setRole(v); setMissing(false); }}
                    options={ROLE_OPTIONS} error={missing && !role ? 'Please choose a role (or "Prefer not to say").' : null} />
                  <Select label="Experience at ABB" placeholder="Choose a range" value={experience} onChange={(v) => { setExperience(v); setMissing(false); }}
                    options={EXPERIENCE_OPTIONS} error={missing && !experience ? 'Please choose a range.' : null}
                    hint="You decide per post whether your role and experience are shown." />
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xl }}>
                    <View style={{ flex: 1, paddingRight: space.md }}>
                      <Text variant="h3">Lock with device authentication</Text>
                      <Text variant="small">Uses your phone&apos;s fingerprint, face, or screen lock when available.</Text>
                    </View>
                    <Switch value={lock} onValueChange={setLock} accessibilityLabel="Lock with device authentication"
                      trackColor={{ true: colors.red, false: colors.border }} />
                  </View>
                  {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
                  <Button label="Create profile" onPress={onCreate} loading={busy} />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center' }}>
                <BrandMark height={30} />
                <Text accessibilityRole="header" style={styles.headline}>
                  {profile ? `Welcome back${profile.displayName && profile.displayName !== 'there' ? `,\n${profile.displayName}` : ''}.` : 'Real people.\nReal conversations.'}
                </Text>
                <Text variant="body" style={{ textAlign: 'center', marginTop: space.sm }}>
                  {profile ? 'Capy kept your seat warm.' : 'Share, support and grow — anonymously.'}
                </Text>
              </View>

              {/* Hero: Capy at the laptop, on a soft warm halo */}
              <View style={styles.heroWrap}>
                <View style={styles.halo} />
                <Capy pose="laptop" size={230} label="Capy, the ABB Help Me mascot, working on a laptop" />
                <View style={styles.speech}>
                  <Text variant="h3" style={{ fontSize: 14 }}>{profile ? 'Good to see you again!' : 'Your safe space at work.'}</Text>
                </View>
              </View>

              <View style={{ gap: space.md }}>
                {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
                {profile && signedIn ? (
                  <>
                    <Button label="Unlock" icon="lock-open-outline" onPress={onUnlock} loading={busy} />
                    {account?.email ? <Text variant="small" style={{ textAlign: 'center' }}>Signed in as {account.email}</Text> : null}
                    {cloud ? <Button label="Sign out" variant="ghost" onPress={() => confirmSignOut(cloud, signOut)} /> : null}
                  </>
                ) : profile ? (
                  <Button label="Log in with email" icon="mail-outline" onPress={() => start('login')} />
                ) : (
                  <>
                    <Button label="Get Started" onPress={() => start('register')} />
                    <Text variant="small" style={{ textAlign: 'center' }}>
                      Existing user?{' '}
                      <Text variant="small" style={styles.link} accessibilityRole="button" onPress={() => start('login')}>Log in</Text>
                    </Text>
                  </>
                )}
                {/* Before unlocking, only this device's data can be wiped: sign out first so the account is kept. */}
                {profile ? (
                  <Button label="Delete local data" variant="ghost"
                    onPress={() => confirmDeleteData(false, async () => { await signOut(); await deleteAllLocalData(); })} />
                ) : null}
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                  <Ionicons name="phone-portrait-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
                  <Text variant="small" style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>
                    {persistent
                      ? 'Your mood check-ins, notes and saved items stay on this device, in encrypted storage. Only community posts you choose to share are stored online.'
                      : 'Web preview: private data is held in memory only and is cleared when you reload.'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.navy, textAlign: 'center', marginTop: space.xl, letterSpacing: -0.4 },
  heroWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: space.xl, minHeight: 270 },
  halo: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: accents.rose.bg },
  speech: { position: 'absolute', top: 6, right: 0, backgroundColor: colors.surface, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.lg, borderBottomLeftRadius: 4, ...shadow },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg, padding: space.md,
    borderRadius: radius.lg, backgroundColor: accents.green.bg },
  link: { color: colors.red, fontWeight: '700', textDecorationLine: 'underline' },
  error: { color: colors.redDark, textAlign: 'center' },
});
