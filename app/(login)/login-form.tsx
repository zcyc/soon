'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Chrome } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { signIn, signUp } from './actions';
import { useAuth } from '@/contexts/auth-context';

interface LoginFormProps {
  mode: 'signin' | 'signup';
}

export function LoginForm({ mode }: LoginFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { refreshUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await signUp(new FormData(e.target as HTMLFormElement));
        if (result.error) {
          setError(result.error);
        } else {
          await refreshUser();
          router.push('/record');
        }
      } else {
        const result = await signIn(new FormData(e.target as HTMLFormElement));
        if (result.error) {
          setError(result.error);
        } else {
          await refreshUser();
          router.push('/record');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    try {
      const response = await fetch(`/api/auth/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(`Failed to initiate ${provider} login`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? t.auth.signUp : t.auth.signIn}</CardTitle>
          <CardDescription>
            {isSignUp ? t.auth.signUpDescription : t.auth.signInDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">{t.auth.name}</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t.auth.loading : (isSignUp ? t.auth.signUp : t.auth.signIn)}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t.auth.orContinueWith}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuth('github')}
                className="w-full"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuth('google')}
                className="w-full"
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm">
            {isSignUp ? (
              <>
                {t.auth.alreadyHaveAccount}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-primary hover:underline"
                >
                  {t.auth.signIn}
                </button>
              </>
            ) : (
              <>
                {t.auth.dontHaveAccount}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary hover:underline"
                >
                  {t.auth.signUp}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
