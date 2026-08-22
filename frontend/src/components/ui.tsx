import { type ReactNode } from 'react';

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

export function Input({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-[var(--admin-input-border)] bg-[var(--admin-input-bg)] px-4 py-2.5 text-sm text-[var(--admin-text)] outline-none transition focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent-soft)] ${className}`}
      {...props}
    />
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
