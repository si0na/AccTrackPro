import React, { useState } from 'react';
import { authApi } from '@/api/crm.api';
import { Building2, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

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
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800/80 rounded-2xl p-10 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Check your email</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              If an account exists for <span className="text-slate-200 font-medium">{email}</span>,
              a password reset link has been sent. The link expires in 15 minutes.
            </p>
            <p className="text-[10px] text-slate-500 mt-3">
              In development mode, the reset token is logged to the backend console.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={onBack}
              className="flex items-center justify-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
            {onGoToReset && (
              <button
                onClick={onGoToReset}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer underline underline-offset-2"
              >
                Already have a reset token?
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 relative font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-950 border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Reset your password</h1>
            <p className="text-xs text-slate-400 mt-1">Enter your email and we'll send a reset link.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-start space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all text-xs cursor-pointer"
          >
            {isLoading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <button
          onClick={onBack}
          className="flex items-center justify-center space-x-1.5 mx-auto text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Sign In</span>
        </button>
      </div>
    </div>
  );
};
