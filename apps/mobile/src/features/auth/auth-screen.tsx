import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Button, TextField } from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { authStrings as t } from './strings';

const emailSchema = z.email();

function authErrorMessage(error: { status?: number; code?: string | undefined }): string {
  if (error.status === 429) return t.tooManyAttempts;
  if (error.code === 'INVALID_EMAIL_OR_PASSWORD') return t.invalidCredentials;
  if (error.code?.startsWith('USER_ALREADY_EXISTS')) return t.emailTaken;
  return t.genericError;
}

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

/** Sign in or sign up. On success the root layout's guard switches to the app. */
export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const next: Errors = {};
    if (isSignUp && name.trim() === '') next.name = t.requiredName;
    if (!emailSchema.safeParse(email.trim()).success) next.email = t.invalidEmail;
    if (password === '') next.password = t.requiredPassword;
    else if (isSignUp && password.length < 8) next.password = t.shortPassword;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const { error } = isSignUp
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password });
    setSubmitting(false);
    if (error) setErrors({ form: authErrorMessage(error) });
  };

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-6 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-1">
            <Text className="text-4xl font-bold text-foreground">{t.appName}</Text>
            <Text className="text-muted-foreground">{t.tagline}</Text>
          </View>
          <View className="gap-4">
            <Text accessibilityRole="header" className="text-xl font-semibold text-foreground">
              {isSignUp ? t.signUpTitle : t.signInTitle}
            </Text>
            {isSignUp ? (
              <TextField
                label={t.name}
                value={name}
                onChangeText={setName}
                autoComplete="name"
                error={errors.name}
              />
            ) : null}
            <TextField
              label={t.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              error={errors.email}
            />
            <TextField
              label={t.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              hint={isSignUp ? t.passwordHint : undefined}
              error={errors.password}
            />
            {errors.form ? (
              <Text accessibilityRole="alert" className="text-sm text-destructive">
                {errors.form}
              </Text>
            ) : null}
            <Button label={isSignUp ? t.signUp : t.signIn} loading={submitting} onPress={submit} />
            <Link href={isSignUp ? '/sign-in' : '/sign-up'} replace asChild>
              <Button label={isSignUp ? t.haveAccount : t.noAccount} variant="ghost" />
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
