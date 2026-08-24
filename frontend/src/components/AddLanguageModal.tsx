import { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus, Sparkles, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  LANGUAGE_CATALOG,
  translateBadgeLabel,
  type CatalogLanguage,
} from '@/lib/languageCatalog';

interface ExistingLanguage {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface TranslateStatus {
  openaiConfigured: boolean;
  freeFallback: boolean;
}

interface AddLanguageModalProps {
  open: boolean;
  existing: ExistingLanguage[];
  translateStatus: TranslateStatus | null;
  saving?: boolean;
  onClose: () => void;
  onAdd: (lang: CatalogLanguage) => Promise<void> | void;
}

export default function AddLanguageModal({
  open,
  existing,
  translateStatus,
  saving,
  onClose,
  onAdd,
}: AddLanguageModalProps) {
  const [query, setQuery] = useState('');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const hasOpenAI = Boolean(translateStatus?.openaiConfigured);

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
    () => new Set(existing.map((l) => l.code.toLowerCase())),
    [existing]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGE_CATALOG.filter((lang) => {
      if (!q) return true;
      return (
        lang.code.includes(q) ||
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q)
      );
    });
  }, [query]);

  if (!open) return null;

  async function handleAdd(lang: CatalogLanguage) {
    if (existingCodes.has(lang.code) || saving || pendingCode) return;
    setPendingCode(lang.code);
    try {
      await onAdd(lang);
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
                🌐
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--admin-text)]">Dil Ekle</h2>
                <p className="text-[11px] admin-text-muted truncate">
                  Çeviri durumu kartta görünür
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

          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-medium">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: translateStatus?.freeFallback
                  ? 'color-mix(in srgb, #22c55e 16%, transparent)'
                  : 'var(--admin-input-bg)',
                color: translateStatus?.freeFallback ? '#16a34a' : 'var(--admin-text-muted)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Ücretsiz {translateStatus?.freeFallback ? 'aktif' : '—'}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: hasOpenAI
                  ? 'color-mix(in srgb, #22c55e 16%, transparent)'
                  : 'color-mix(in srgb, #f59e0b 14%, transparent)',
                color: hasOpenAI ? '#16a34a' : '#d97706',
              }}
            >
              {hasOpenAI ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              OpenAI {hasOpenAI ? 'bağlı' : 'yok'}
            </span>
          </div>

          <div className="relative mt-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 admin-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dil ara…"
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
            filtered.map((lang) => {
              const already = existingCodes.has(lang.code);
              const badge = translateBadgeLabel(lang.translate, hasOpenAI);
              const busy = pendingCode === lang.code;

              return (
                <div
                  key={lang.code}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition"
                  style={{
                    background: already ? 'var(--admin-input-bg)' : undefined,
                    opacity: already ? 0.72 : 1,
                  }}
                >
                  <span className="text-lg leading-none w-7 text-center shrink-0">{lang.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--admin-text)] truncate">
                        {lang.name}
                      </p>
                      <span className="text-[10px] font-bold uppercase admin-text-subtle shrink-0">
                        {lang.code}
                      </span>
                      <span
                        className="hidden sm:inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background:
                            badge.tone === 'ok'
                              ? 'color-mix(in srgb, #22c55e 14%, transparent)'
                              : badge.tone === 'warn'
                                ? 'color-mix(in srgb, #f59e0b 14%, transparent)'
                                : 'var(--admin-input-bg)',
                          color:
                            badge.tone === 'ok'
                              ? '#16a34a'
                              : badge.tone === 'warn'
                                ? '#d97706'
                                : 'var(--admin-text-muted)',
                        }}
                      >
                        {badge.text}
                      </span>
                    </div>
                  </div>

                  {already ? (
                    <span className="text-[11px] font-medium admin-text-muted shrink-0 px-1">
                      Eklendi
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAdd(lang)}
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
