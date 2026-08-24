import { type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

interface AdminFilterBarProps {
  search?: ReactNode;
  filterOpen: boolean;
  onFilterToggle: () => void;
  activeFilterCount: number;
  recordLabel: string;
  onClear: () => void;
  children: ReactNode;
}

export function AdminFilterBar({
  search,
  filterOpen,
  onFilterToggle,
  activeFilterCount,
  recordLabel,
  onClear,
  children,
}: AdminFilterBarProps) {
  return (
    <div
      className="p-4 sm:p-5 border-b flex flex-col gap-4"
      style={{ borderColor: 'var(--admin-card-border)' }}
    >
      <div
        className={`flex flex-col lg:flex-row lg:items-center gap-3 ${
          search ? 'justify-between' : 'lg:justify-end'
        }`}
      >
        {search && <div className="relative flex-1 max-w-md">{search}</div>}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onFilterToggle}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
              filterOpen ? 'ring-2 ring-[var(--admin-accent)]' : ''
            }`}
            style={{
              background: 'var(--admin-input-bg)',
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-text)',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtrele
            {activeFilterCount > 0 && (
              <span
                className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center"
                style={{
                  background: 'var(--admin-accent)',
                  color: 'var(--admin-btn-primary-text)',
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <span className="text-sm admin-text-muted">{recordLabel}</span>
        </div>
      </div>

      <div
        className={`grid transition-all duration-300 ease-out ${
          filterOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div
            className="rounded-2xl px-5 py-4 flex flex-wrap items-end gap-y-5"
            style={{ background: 'var(--admin-input-bg)' }}
          >
            <div className="flex flex-wrap items-end gap-y-5 flex-1 min-w-0">
              {children}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition shrink-0 pb-1.5"
            >
              Temizle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FilterSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`admin-filter-section shrink-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function FilterChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium transition"
            style={{
              background: value === opt.value ? 'var(--admin-accent)' : 'var(--admin-card)',
              color:
                value === opt.value ? 'var(--admin-btn-primary-text)' : 'var(--admin-text-muted)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--admin-text)]">{label}</p>
        {description && <p className="text-xs admin-text-subtle mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
        style={{
          background: checked ? 'var(--admin-accent)' : 'var(--admin-card-border)',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </label>
  );
}

export function FilterFieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
      {children}
    </p>
  );
}
