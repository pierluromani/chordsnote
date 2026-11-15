import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Note } from '../components/icons';
import { Eyebrow, PrimaryButton, Tap } from '../components/ui';
import {
  authMessage,
  checkGoogleRedirectResult,
  signIn,
  signInWithGoogle,
  signUp,
  useAuth,
} from '../lib/auth';
import { syncBands } from '../lib/bandSync';
import { font, palette, radius } from '../lib/theme';

type Mode = 'signin' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Signing in, so the bands you're in belong to you rather than to one phone.
 *
 * One screen for both jobs: the fields are nearly the same, and a separate
 * "register" page mostly exists to make people who already have an account
 * hunt for the other one.
 */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const account = useAuth((state) => state.account);

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = password.length >= 6;

  useEffect(() => {
    checkGoogleRedirectResult().catch((problem) => setError(authMessage(problem)));
  }, []);

  // Already signed in — nothing to do here.
  if (account) {
    router.replace('/profile');
    return <View style={styles.screen} />;
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      // Bands come down before the screen closes, so the list behind it is
      // already right when it appears.
      await syncBands().catch(() => ({ pulled: 0, pushed: 0 }));
      router.replace('/profile');
    } catch (problem) {
      setError(authMessage(problem));
      setBusy(false);
    }
  };

  const submit = () =>
    run(() =>
      mode === 'signup' ? signUp(email, password, name) : signIn(email, password)
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={{ height: insets.top, backgroundColor: palette.bg }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 32,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Note size={17} color={palette.accentInk} />
          </View>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Bentornato' : 'Crea il tuo account'}
          </Text>
          <Text style={styles.blurb}>
            Con un account puoi invitare chi suona con te e tenere repertorio e scalette
            uguali su tutti i telefoni della band.
          </Text>
        </View>

        {mode === 'signup' ? (
          <>
            <Eyebrow style={styles.label}>Nome</Eyebrow>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Come ti chiami"
              placeholderTextColor={palette.textGhost}
              autoCapitalize="words"
              autoComplete="name"
              editable={!busy}
              accessibilityLabel="Nome"
              style={styles.input}
            />
          </>
        ) : null}

        <Eyebrow style={styles.label}>Email</Eyebrow>
        <TextInput
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          placeholder="tu@esempio.it"
          placeholderTextColor={palette.textGhost}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          editable={!busy}
          accessibilityLabel="Email"
          style={[
            styles.input,
            mode === 'signup' && emailTouched && !emailValid && styles.inputInvalid,
          ]}
        />
        {mode === 'signup' && emailTouched && !emailValid ? (
          <Text style={styles.fieldError}>Inserisci un indirizzo email valido.</Text>
        ) : null}

        <Eyebrow style={styles.label}>Password</Eyebrow>
        <TextInput
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          placeholder="Almeno 6 caratteri"
          placeholderTextColor={palette.textGhost}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          editable={!busy}
          onSubmitEditing={submit}
          returnKeyType="go"
          accessibilityLabel="Password"
          style={[
            styles.input,
            mode === 'signup' && passwordTouched && !passwordValid && styles.inputInvalid,
          ]}
        />
        {mode === 'signup' && passwordTouched && !passwordValid ? (
          <Text style={styles.fieldError}>La password deve avere almeno 6 caratteri.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={mode === 'signin' ? 'Accedi' : 'Crea account'}
          onPress={submit}
          disabled={
            busy ||
            !email.trim() ||
            !password ||
            (mode === 'signup' && (!emailValid || !passwordValid))
          }
        />

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.dividerText}>oppure</Text>
          <View style={styles.rule} />
        </View>

        <Tap
          onPress={() => run(signInWithGoogle)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Continua con Google"
          style={[styles.google, busy && { opacity: 0.5 }]}
        >
          <GoogleG />
          <Text style={styles.googleText}>Continua con Google</Text>
        </Tap>

        <Tap
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
          disabled={busy}
          accessibilityRole="button"
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {mode === 'signin'
              ? 'Non hai un account? Registrati'
              : 'Hai già un account? Accedi'}
          </Text>
        </Tap>

        {busy ? (
          <ActivityIndicator color={palette.accent} style={{ marginTop: 18 }} />
        ) : null}

        <Text style={styles.footnote}>
          Serve un account per usare ChordsNote: brani, scalette e band restano legati a te
          e ti seguono su ogni dispositivo.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Google's mark, drawn inline so the button needs no network image. */
function GoogleG() {
  return (
    <View style={styles.gMark}>
      <Text style={styles.gText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.logo,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: font.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: palette.text,
    textAlign: 'center',
  },
  blurb: {
    fontFamily: font.meta,
    fontSize: 13,
    lineHeight: 19,
    color: palette.textDim,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  label: {
    marginBottom: 7,
  },
  input: {
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 18,
  },
  inputInvalid: {
    borderColor: palette.accent,
    marginBottom: 6,
  },
  fieldError: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.accent,
    marginBottom: 14,
  },
  error: {
    fontFamily: font.meta,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.accent,
    marginBottom: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textFaint,
  },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.round,
    paddingVertical: 13,
  },
  gMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.borderControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gText: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    color: '#4285F4',
  },
  googleText: {
    fontFamily: font.displayMid,
    fontSize: 14,
    color: palette.text,
  },
  switch: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  switchText: {
    fontFamily: font.metaSemi,
    fontSize: 13,
    color: palette.accent,
  },
  footnote: {
    fontFamily: font.meta,
    fontSize: 11.5,
    lineHeight: 17,
    color: palette.textFaint,
    textAlign: 'center',
  },
});
