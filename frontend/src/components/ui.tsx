import { useId, type ReactNode } from 'react';

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
  { input: string; label: string; bgLabel: string }
> = {
  admin: {
    input:
      'border-[var(--admin-input-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text)] focus:border-[var(--admin-accent)] focus:ring-[var(--admin-accent-soft)]',
    label:
      'text-[var(--admin-text-muted)] peer-focus:text-[var(--admin-accent)] peer-[:not(:placeholder-shown)]:text-[var(--admin-accent)]',
    bgLabel: 'bg-[var(--admin-input-bg)]',
  },
  glass: {
    input:
      'border-white/35 bg-white/5 text-white focus:border-white/80 focus:ring-white/15 placeholder:text-transparent',
    label:
      'text-white/55 peer-focus:text-white/90 peer-[:not(:placeholder-shown)]:text-white/80',
    bgLabel: 'bg-transparent',
  },
  public: {
    input:
      'border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/20',
    label:
      'text-slate-400 peer-focus:text-indigo-600 peer-[:not(:placeholder-shown)]:text-indigo-600',
    bgLabel: 'bg-white',
  },
};

export function Input({
  label,
  variant = 'admin',
  className = '',
  placeholder,
  id: externalId,
  ...props
}: InputProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const displayLabel = label ?? placeholder ?? '';
  const styles = inputVariants[variant];

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        placeholder=" "
        className={`peer w-full rounded-xl border px-4 pt-5 pb-2.5 text-sm outline-none transition focus:ring-2 ${styles.input}`}
        {...props}
      />
      {displayLabel ? (
        <label
          htmlFor={id}
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 px-0.5 text-sm pointer-events-none transition-all duration-200 origin-left
            peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium
            peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium
            ${styles.label} ${styles.bgLabel}`}
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
  ...props
}: TextareaProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const displayLabel = label ?? placeholder ?? '';
  const styles = inputVariants[variant];

  return (
    <div className={`relative ${className}`}>
      <textarea
        id={id}
        placeholder=" "
        className={`peer w-full rounded-xl border px-4 pt-6 pb-2.5 text-sm outline-none transition focus:ring-2 min-h-[88px] resize-y ${styles.input}`}
        {...props}
      />
      {displayLabel ? (
        <label
          htmlFor={id}
          className={`absolute left-3.5 top-4 px-0.5 text-sm pointer-events-none transition-all duration-200 origin-left
            peer-focus:top-2 peer-focus:text-xs peer-focus:font-medium
            peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium
            ${styles.label} ${styles.bgLabel}`}
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
