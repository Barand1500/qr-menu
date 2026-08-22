import { useId, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: Props) {
  return (
    <div className={`admin-card ${className}`}>
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-[var(--admin-accent)] text-[var(--admin-sidebar-active-text)] hover:opacity-90 shadow-sm [data-theme=light]:text-white',
    secondary:
      'bg-[var(--admin-card)] text-[var(--admin-text)] border border-[var(--admin-card-border)] hover:bg-[var(--admin-accent-soft)]',
    ghost: 'text-[var(--admin-text-muted)] hover:bg-[var(--admin-accent-soft)]',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export type InputVariant = 'admin' | 'glass' | 'public';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  variant?: InputVariant;
}

const inputVariants: Record<
  InputVariant,
  { input: string; label: string; labelFloat: string; labelBg: string }
> = {
  admin: {
    input:
      'border-[var(--admin-input-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text)] focus:border-[var(--admin-accent)]',
    label: 'text-[var(--admin-text-muted)]',
    labelFloat: 'text-[var(--admin-accent)]',
    labelBg: 'bg-[var(--admin-input-bg)]',
  },
  glass: {
    input:
      'border-white/40 bg-white/5 text-white focus:border-white/90 focus:ring-0',
    label: 'text-white/50',
    labelFloat: 'text-white',
    labelBg: 'floating-label-bg-glass',
  },
  public: {
    input:
      'border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/15',
    label: 'text-slate-400',
    labelFloat: 'text-indigo-600',
    labelBg: 'bg-white',
  },
};

function useFloatedState(
  value: InputProps['value'],
  defaultValue: InputProps['defaultValue']
) {
  const [focused, setFocused] = useState(false);
  const hasValue =
    value !== undefined && value !== null
      ? String(value).length > 0
      : defaultValue !== undefined && defaultValue !== null && String(defaultValue).length > 0;
  return { focused, setFocused, floated: focused || hasValue };
}

export function Input({
  label,
  variant = 'admin',
  className = '',
  placeholder,
  id: externalId,
  value,
  defaultValue,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const displayLabel = label ?? placeholder ?? '';
  const styles = inputVariants[variant];
  const { setFocused, floated } = useFloatedState(value, defaultValue);

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        placeholder=" "
        value={value}
        defaultValue={defaultValue}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`peer w-full min-h-[52px] rounded-xl border px-4 pb-2.5 pt-4 text-sm outline-none transition-all duration-200 focus:ring-2 ${styles.input}`}
        {...props}
      />
      {displayLabel ? (
        <label
          htmlFor={id}
          className={`absolute left-3 px-1 pointer-events-none transition-all duration-200 ease-out origin-left leading-none
            ${floated
              ? `top-0 -translate-y-1/2 text-[11px] font-medium ${styles.labelFloat} ${styles.labelBg}`
              : `top-1/2 -translate-y-1/2 text-sm ${styles.label}`
            }`}
        >
          {displayLabel}
        </label>
      ) : null}
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  variant?: InputVariant;
}

export function Textarea({
  label,
  variant = 'admin',
  className = '',
  placeholder,
  id: externalId,
  value,
  defaultValue,
  onFocus,
  onBlur,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const displayLabel = label ?? placeholder ?? '';
  const styles = inputVariants[variant];
  const { setFocused, floated } = useFloatedState(value, defaultValue);

  return (
    <div className={`relative ${className}`}>
      <textarea
        id={id}
        placeholder=" "
        value={value}
        defaultValue={defaultValue}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`peer w-full rounded-xl border px-4 pb-2.5 pt-5 text-sm outline-none transition-all duration-200 focus:ring-2 min-h-[96px] resize-y ${styles.input}`}
        {...props}
      />
      {displayLabel ? (
        <label
          htmlFor={id}
          className={`absolute left-3 px-1 pointer-events-none transition-all duration-200 ease-out origin-left leading-none
            ${floated
              ? `top-0 -translate-y-1/2 text-[11px] font-medium ${styles.labelFloat} ${styles.labelBg}`
              : `top-5 text-sm ${styles.label}`
            }`}
        >
          {displayLabel}
        </label>
      ) : null}
    </div>
  );
}

export function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent-text)]'
          : 'bg-[var(--admin-input-bg)] text-[var(--admin-text-subtle)]'
      }`}
    >
      {active ? 'Aktif' : 'Pasif'}
    </span>
  );
}

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold text-[var(--admin-text)]">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center admin-text-muted text-sm">{message}</div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--admin-accent)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
