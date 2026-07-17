import React, { useState } from 'react';
import { authApi } from '@/api/crm.api';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, Button, ErrorBanner, FormField, INPUT_CLS } from '@/components/ui';

interface ForgotPasswordPageProps {
  onBack: () => void;
  onGoToReset?: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBack, onGoToReset }) => {
  const [email, setEmail]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch {
      // Don't reveal server errors — show the same success UI to prevent enumeration
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen w-full relative isolate overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/40 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-slate-300/30 blur-3xl" />
        </div>
        <Card padding="none" className="w-full max-w-md">
          <div className="p-10 sm:p-11 text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto ring-4 ring-blue-500/10">
              <CheckCircle2 className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Check your email</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                If an account exists for <span className="text-slate-700 font-medium">{email}</span>,
                a password reset link has been sent. The link expires in 15 minutes.
              </p>
              <p className="text-[10px] text-slate-400 mt-3">
                In development mode, the reset token is logged to the backend console.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2 pt-1">
              <button
                onClick={onBack}
                className="flex items-center justify-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
              {onGoToReset && (
                <button
                  onClick={onGoToReset}
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer underline underline-offset-2"
                >
                  Already have a reset token?
                </button>
              )}
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
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Reset your password</h1>
              <p className="text-xs text-slate-500 mt-1.5">Enter your email and we'll send a reset link.</p>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </FormField>

            <Button type="submit" variant="primary" size="md" disabled={isLoading} className="w-full">
              {isLoading ? 'Sending…' : 'Send Reset Link'}
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
