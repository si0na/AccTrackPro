import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (already sized by the caller). */
  icon?: React.ReactNode;
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/10 border border-transparent',
  secondary:
    'border border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold bg-white',
  danger:
    'bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/10 border border-transparent',
  warning:
    'bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-500/10 border border-transparent',
  success:
    'bg-green-600 hover:bg-green-700 text-white font-bold shadow-sm shadow-green-600/10 border border-transparent',
  ghost:
    'text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold border border-transparent',
};

const SIZE_CLS: Record<ButtonSize, string> = {
  xs: 'px-3 py-1 text-xs rounded-lg',
  sm: 'px-4 py-2 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
};

/**
 * Standard button. Variants map to the app-wide palette (blue primary,
 * outlined secondary, red danger, amber edit/warning) so every module renders
 * identical buttons for identical intents.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'sm',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLS[variant]} ${SIZE_CLS[size]} ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
);
