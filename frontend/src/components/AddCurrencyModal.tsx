import { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { CURRENCY_CATALOG, type CatalogCurrency } from '@/lib/currencyCatalog';

interface ExistingCurrency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

interface AddCurrencyModalProps {
  open: boolean;
  existing: ExistingCurrency[];
  saving?: boolean;
  onClose: () => void;
  onAdd: (currency: CatalogCurrency) => Promise<void> | void;
}

export default function AddCurrencyModal({
  open,
  existing,
  saving,
  onClose,
  onAdd,
}: AddCurrencyModalProps) {
  const [query, setQuery] = useState('');
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPendingCode(null);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const existingCodes = useMemo(
    () => new Set(existing.map((c) => c.code.toUpperCase())),
    [existing]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURRENCY_CATALOG.filter((c) => {
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
      );
    });
  }, [query]);

  if (!open) return null;

  async function handleAdd(currency: CatalogCurrency) {
    if (existingCodes.has(currency.code) || saving || pendingCode) return;
    setPendingCode(currency.code);
    try {
      await onAdd(currency);
    } finally {
      setPendingCode(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:w-[520px] sm:max-w-[92vw] max-h-[min(520px,78vh)] flex flex-col rounded-t-[24px] sm:rounded-[24px] shadow-2xl animate-slide-up overflow-hidden"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 pt-4 pb-3 shrink-0"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: 'var(--admin-accent-soft)' }}
              >
                💱
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--admin-text)]">Para Birimi Ekle</h2>
                <p className="text-[11px] admin-text-muted truncate">
                  Kur yok — yazdığın fiyat olduğu gibi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-accent-soft)] transition shrink-0"
              aria-label="Kapat"
            >
              <X className="w-4 h-4 admin-text-muted" />
            </button>
          </div>

          <div className="relative mt-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 admin-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara (TRY, Dolar, €…)"
              className="w-full h-9 pl-9 pr-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--admin-input-bg)',
                border: '1px solid var(--admin-card-border)',
                color: 'var(--admin-text)',
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto admin-scroll px-2.5 py-2 space-y-0.5 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm admin-text-muted text-center py-8">Sonuç bulunamadı</p>
          ) : (
            filtered.map((currency) => {
              const already = existingCodes.has(currency.code);
              const busy = pendingCode === currency.code;

              return (
                <div
                  key={currency.code}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition"
                  style={{
                    background: already ? 'var(--admin-input-bg)' : undefined,
                    opacity: already ? 0.72 : 1,
                  }}
                >
                  <span className="text-lg leading-none w-7 text-center shrink-0">
                    {currency.flag}
                  </span>
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-[var(--admin-text)] truncate">
                      {currency.name}
                    </p>
                    <span className="text-[10px] font-bold uppercase admin-text-subtle shrink-0">
                      {currency.code}
                    </span>
                    <span className="text-[11px] admin-text-muted shrink-0">{currency.symbol}</span>
                  </div>

                  {already ? (
                    <span className="text-[11px] font-medium admin-text-muted shrink-0 px-1">
                      Eklendi
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAdd(currency)}
                      disabled={Boolean(saving || pendingCode)}
                      className="!h-7 !px-2.5 !rounded-lg shrink-0 gap-0.5 !text-xs"
                    >
                      {busy ? (
                        '…'
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Ekle
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          className="px-4 py-2.5 shrink-0 flex justify-end"
          style={{ borderTop: '1px solid var(--admin-card-border)' }}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="!rounded-xl"
          >
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
