import React, { useState } from 'react';
import { authApi } from '@/api/crm.api';
import { Lock, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Card, Button, ErrorBanner, FormField, INPUT_CLS } from '@/components/ui';

interface ResetPasswordPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Contains number', pass: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const color = score === 0 ? 'bg-slate-200' : score === 1 ? 'bg-amber-500' : 'bg-emerald-500';

  if (!password) return null;
  return (
    <div className="space-y-1.5 mt-1.5">
      <div className="flex space-x-1">
        {checks.map((_, i) => (
          <div key={i} className={`flex-1 h-0.5 rounded-full transition-colors ${i < score ? color : 'bg-slate-200'}`} />
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

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onBack, onSuccess }) => {
  const [token, setToken]               = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) { setError('Please enter your reset token.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/\d/.test(newPassword)) { setError('Password must contain at least one number.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token.trim(), newPassword);
      setSuccess(true);
      setTimeout(onSuccess, 2500);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setError(typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : 'Invalid or expired token.'));
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
              <h2 className="text-lg font-bold text-slate-800">Password reset!</h2>
              <p className="text-xs text-slate-500 mt-1.5">Redirecting you to sign in…</p>
            </div>
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
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/20 ring-4 ring-blue-600/10">
              AT
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Set new password</h1>
              <p className="text-xs text-slate-500 mt-1.5">Paste your reset token and choose a new password.</p>
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Reset Token" required>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from your email / backend console"
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>

            <FormField label="New Password" required>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
              <PasswordStrength password={newPassword} />
            </FormField>

            <FormField label="Confirm New Password" required>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </FormField>

            <Button type="submit" variant="primary" size="md" disabled={isLoading} className="w-full">
              {isLoading ? 'Resetting…' : 'Reset Password'}
            </Button>
          </form>

          <div className="pt-5 border-t border-slate-100">
            <button
              onClick={onBack}
              className="flex items-center justify-center space-x-1.5 mx-auto text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
