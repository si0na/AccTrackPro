import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { User, Mail, Lock, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Card, Button, ErrorBanner, FormField, INPUT_CLS } from '@/components/ui';

import { ReflectOneLogo } from '@/components/common/ReflectOneLogo';

interface SignUpPageProps {
  onGoToLogin: () => void;
  onSignUp: () => void;
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Contains number', pass: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const colors = ['bg-slate-200', 'bg-amber-500', 'bg-emerald-500'];

  if (!password) return null;
  return (
    <div className="space-y-1.5 mt-1.5">
      <div className="flex space-x-1">
        {checks.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-0.5 rounded-full transition-colors ${i < score ? colors[score] : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map((c) => (
          <span key={c.label} className={`text-[9px] font-medium ${c.pass ? 'text-emerald-600' : 'text-slate-400'}`}>
            {c.pass ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onGoToLogin }) => {
  const { register } = useCRM();

  const [name, setName]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirm]     = useState('');
  const [showPass, setShowPass]           = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState(false);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => onGoToLogin(), 2000);
    return () => clearTimeout(t);
  }, [success, onGoToLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim())          { setError('Please enter your full name.'); return; }
    if (!email.trim())         { setError('Please enter a valid work email.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (!/\d/.test(password))  { setError('Password must contain at least one number.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      setSuccess(true);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setError(typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full relative isolate overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/40 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-slate-300/30 blur-3xl" />
        </div>
        <Card padding="none" className="w-full max-w-md">
          <div className="p-10 sm:p-11 text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Account Created!</h2>
              <p className="text-xs text-slate-500 mt-1.5">
                Welcome, <span className="text-slate-700 font-semibold">{name}</span>. Redirecting you to the login page…
              </p>
            </div>
            <button
              onClick={onGoToLogin}
              className="flex items-center justify-center space-x-1.5 mx-auto text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer"
            >
              <span>Go to Login now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>
      </div>
    );
  }

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
            <FormField label="Full Name" required>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Alex Morgan"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </FormField>

            <FormField label="Work Email" required>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.morgan@reflectionsinfos.com"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </FormField>

            <FormField label="Password" required>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters, at least 1 number"
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
              <PasswordStrength password={password} />
            </FormField>

            <FormField label="Confirm Password" required>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </FormField>

            <Button type="submit" variant="primary" size="md" disabled={isLoading} className="w-full">
              {isLoading ? (
                <span>Creating account…</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </>
              )}
            </Button>
          </form>

          <div className="pt-5 border-t border-slate-100">
            <p className="text-center text-xs text-slate-500">
              Already have an account?{' '}
              <button
                onClick={onGoToLogin}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
