'use client';

import { useQueryClient } from '@bolsillo/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { authStrings as t } from './strings';

const signInSchema = z.object({
  email: z.email(t.invalidEmail),
  password: z.string().min(1, t.requiredPassword),
});

const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, t.requiredName).max(80),
  password: z.string().min(8, t.shortPassword).max(128),
});

type SignUpValues = z.infer<typeof signUpSchema>;

/** Maps Better Auth error codes to Spanish messages (never echoes server text). */
function authErrorMessage(error: { status?: number; code?: string | undefined }): string {
  if (error.status === 429) return t.tooManyAttempts;
  if (error.code === 'INVALID_EMAIL_OR_PASSWORD') return t.invalidCredentials;
  if (error.code?.startsWith('USER_ALREADY_EXISTS')) return t.emailTaken;
  return t.genericError;
}

/** Only same-site relative paths are accepted as the post-login destination. */
function safeNext(next: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(isSignUp ? signUpSchema : signInSchema.extend({ name: z.string() })),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    const { error } = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    // Data from a previous session must not leak into this one.
    queryClient.clear();
    router.replace(safeNext(searchParams.get('next')));
    router.refresh();
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{isSignUp ? t.signUpTitle : t.signInTitle}</CardTitle>
        <CardDescription>{isSignUp ? t.signUpDescription : t.signInDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {isSignUp ? (
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="name">{t.name}</FieldLabel>
                <Input
                  id="name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  {...form.register('name')}
                />
                <FieldError errors={[errors.name]} />
              </Field>
            ) : null}
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">{t.email}</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                {...form.register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="password">{t.password}</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                aria-invalid={Boolean(errors.password)}
                {...form.register('password')}
              />
              {isSignUp ? <FieldDescription>{t.passwordHint}</FieldDescription> : null}
              <FieldError errors={[errors.password]} />
            </Field>
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting
                ? isSignUp
                  ? t.signingUp
                  : t.signingIn
                : isSignUp
                  ? t.signUp
                  : t.signIn}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? t.haveAccount : t.noAccount}{' '}
              <Link
                href={isSignUp ? '/sign-in' : '/sign-up'}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {isSignUp ? t.goToSignIn : t.goToSignUp}
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
