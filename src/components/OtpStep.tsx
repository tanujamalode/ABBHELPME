import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Capy } from '@/components/Capy';
import { Badge, Button, Text } from '@/components/ui';
import { accents, colors, radius, space } from '@/constants/brand';
import { verifiedLabel, verifier } from '@/data/auth';
import { OTP_LENGTH, REQUEST_FAILURE_TEXT, VerificationError, type OtpChallenge, type OtpResult } from '@/lib/verification';

const REASON: Record<Exclude<OtpResult, { ok: true }>['reason'], string> = {
  wrong: 'That code is not right.',
  expired: 'That code has expired. Request a new one.',
  locked: 'Too many tries. Request a new code.',
  no_code: 'Request a new code to continue.',
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Email code entry: six code boxes over one hidden input, auto-submit on the last digit,
 * resend countdown, attempt limit. A correct code signs the user in.
 */
export function OtpStep({ email, challenge, createUser = true, onChallenge, onVerified, onChangeEmail }: {
  email: string; challenge: OtpChallenge; createUser?: boolean; onChallenge: (c: OtpChallenge) => void;
  onVerified: () => void; onChangeEmail: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { input.current?.focus(); }, []);

  const resendIn = challenge.resendAt - now;
  const expired = now > challenge.expiresAt;

  const submit = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true); setError(null);
    const r = await verifier.confirmCode(email, value);
    if (r.ok) { onVerified(); return; }
    setError(r.reason === 'wrong' ? `${REASON.wrong} ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'try' : 'tries'} left.` : REASON[r.reason]);
    setCode('');
    setBusy(false);
    input.current?.focus();
  };

  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits); setError(null);
    if (digits.length === OTP_LENGTH) submit(digits);
  };

  const resend = async () => {
    try {
      const c = await verifier.requestCode(email, undefined, { createUser });
      onChallenge(c); setCode(''); setError(null);
      input.current?.focus();
    } catch (e) {
      setError(REQUEST_FAILURE_TEXT[e instanceof VerificationError ? e.reason : 'send_failed']);
    }
  };

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: space.lg }}>
        <Capy pose="thinking" size={96} motion="pop" />
        <Text variant="title" accessibilityRole="header" style={{ marginTop: space.md, textAlign: 'center' }}>Check your email</Text>
        <Text variant="body" style={{ textAlign: 'center', marginTop: space.xs }}>
          Enter the 6-digit code for <Text variant="body" style={{ fontWeight: '700', color: colors.navy }}>{email}</Text>
        </Text>
      </View>

      <Pressable onPress={() => input.current?.focus()} accessibilityRole="none" style={styles.boxes}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const filled = i < code.length;
          const active = i === code.length && !busy;
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, !!error && styles.boxError]}>
              <Text style={styles.digit}>{filled ? code[i] : ''}</Text>
            </View>
          );
        })}
        <TextInput ref={input} value={code} onChangeText={onChange} keyboardType="number-pad" maxLength={OTP_LENGTH}
          textContentType="oneTimeCode" autoComplete="sms-otp" accessibilityLabel="6-digit verification code" style={styles.hidden} />
      </Pressable>

      <View accessibilityLiveRegion="polite" style={{ minHeight: 22, marginTop: space.sm }}>
        {error ? <Text variant="small" style={{ color: colors.redDark, textAlign: 'center' }}>{error}</Text> : null}
      </View>

      {verifier.isDemo && challenge.demoCode ? (
        <View style={styles.demo}>
          <Badge label={verifiedLabel()} tone="sample" />
          <Text variant="small" style={{ flex: 1, color: colors.navy2 }}>
            Demo: no email is sent. Use code <Text variant="small" style={{ fontWeight: '800', color: colors.navy, letterSpacing: 2 }}>{challenge.demoCode}</Text>.
          </Text>
        </View>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Button label="Verify" onPress={() => submit(code)} disabled={code.length !== OTP_LENGTH || expired} loading={busy} />
        <Button label={resendIn > 0 ? `Resend code in ${fmt(resendIn)}` : 'Resend code'} variant="ghost" onPress={resend} disabled={resendIn > 0} />
        <Button label="Use a different email" variant="ghost" onPress={onChangeEmail} />
      </View>
      <Text variant="small" style={{ textAlign: 'center', marginTop: space.sm }}>
        {expired ? 'This code has expired.' : `Code valid for ${fmt(challenge.expiresAt - now)}. `}
        {verifier.isDemo ? 'Demo: your email is not stored or sent.' : 'Check your spam folder if it hasn’t arrived.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  box: { width: 46, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: colors.red, backgroundColor: accents.rose.bg },
  boxError: { borderColor: colors.red },
  digit: { fontSize: 24, fontWeight: '800', color: colors.navy },
  hidden: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: accents.amber.bg,
    marginTop: space.sm },
});
