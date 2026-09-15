type AdminListPagerProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function AdminListPager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: AdminListPagerProps) {
  if (total <= pageSize || pageCount <= 1) return null;

  const safePage = Math.min(Math.max(1, page), pageCount);

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 border-t"
      style={{ borderColor: 'var(--admin-card-border)' }}
    >
      <button
        type="button"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        className="h-9 px-3 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition hover:bg-[var(--admin-accent-soft)]"
        style={{
          border: '1px solid var(--admin-card-border)',
          background: 'var(--admin-card)',
          color: 'var(--admin-text)',
        }}
      >
        Önceki
      </button>
      <span className="text-sm font-bold text-[var(--admin-text)] tabular-nums">
        {safePage} / {pageCount}
        <span className="ml-1.5 font-semibold admin-text-muted">· {total} kayıt</span>
      </span>
      <button
        type="button"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(safePage + 1)}
        className="h-9 px-3 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition hover:bg-[var(--admin-accent-soft)]"
        style={{
          border: '1px solid var(--admin-card-border)',
          background: 'var(--admin-card)',
          color: 'var(--admin-text)',
        }}
      >
        Sonraki
      </button>
    </div>
  );
}
