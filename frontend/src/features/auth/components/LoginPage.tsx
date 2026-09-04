import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Card, Button, ErrorBanner, FormField, INPUT_CLS } from '@/components/ui';

import { ReflectOneLogo } from '@/components/common/ReflectOneLogo';

interface LoginPageProps {
  onGoToSignUp?: () => void;
  onForgotPassword?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onGoToSignUp, onForgotPassword }) => {
  const { login } = useCRM();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim())    { setError('Please enter your email address.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }

    setIsLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setError(typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : 'Invalid email or password.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative isolate overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/40 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-slate-300/30 blur-3xl" />
      </div>
      <Card padding="none" className="w-full max-w-md">
        <div className="p-8 sm:p-9 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <ReflectOneLogo className="w-14 h-14" />
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">ReflectOne</h1>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 mt-1">
                ONE PLATFORM. EVERY RELATIONSHIP.
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-teal-700/80 mt-0.5">
                CONNECT · COLLABORATE · DELIVER · GROW
              </p>
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Email Address" required>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.smith@reflectionsinfos.com"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </FormField>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Password</span>
                {onForgotPassword && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${INPUT_CLS} pl-9 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="md" disabled={isLoading} className="w-full">
              {isLoading ? (
                <span>Signing in…</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>

          {onGoToSignUp && (
            <div className="pt-5 border-t border-slate-100">
              <p className="text-center text-xs text-slate-500">
                New to ReflectOne?{' '}
                <button
                  onClick={onGoToSignUp}
                  className="text-blue-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
