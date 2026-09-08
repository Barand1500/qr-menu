import { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus, Sparkles, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import LanguageFlag from '@/components/LanguageFlag';
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
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-lg max-h-[min(560px,78vh)] flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up overflow-hidden"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                style={{ background: 'var(--admin-accent-soft)' }}
              >
                🌐
              </div>
              <div className="flex items-center min-h-11">
                <h2 className="text-base font-bold text-[var(--admin-text)]">Dil Ekle</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--admin-accent-soft)] transition"
              aria-label="Kapat"
            >
              <X className="w-4 h-4 admin-text-muted" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: translateStatus?.freeFallback
                  ? 'color-mix(in srgb, #22c55e 16%, transparent)'
                  : 'var(--admin-input-bg)',
                color: translateStatus?.freeFallback ? '#16a34a' : 'var(--admin-text-muted)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Ücretsiz çeviri {translateStatus?.freeFallback ? 'aktif' : '—'}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: hasOpenAI
                  ? 'color-mix(in srgb, #22c55e 16%, transparent)'
                  : 'color-mix(in srgb, #f59e0b 14%, transparent)',
                color: hasOpenAI ? '#16a34a' : '#d97706',
              }}
            >
              {hasOpenAI ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              OpenAI {hasOpenAI ? 'bağlı' : 'anahtar yok'}
            </span>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 admin-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dil ara (Türkçe, English, de…)"
              className="w-full h-11 pl-10 pr-3 rounded-2xl text-sm outline-none"
              style={{
                background: 'var(--admin-input-bg)',
                border: '1px solid var(--admin-card-border)',
                color: 'var(--admin-text)',
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto admin-scroll px-3 py-3 space-y-1.5 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm admin-text-muted text-center py-10">Sonuç bulunamadı</p>
          ) : (
            filtered.map((lang) => {
              const already = existingCodes.has(lang.code);
              const badge = translateBadgeLabel(lang.translate, hasOpenAI);
              const busy = pendingCode === lang.code;

              return (
                <div
                  key={lang.code}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition"
                  style={{
                    background: already ? 'var(--admin-input-bg)' : undefined,
                    opacity: already ? 0.72 : 1,
                  }}
                >
                  <span className="w-9 h-7 inline-flex items-center justify-center shrink-0">
                    <LanguageFlag code={lang.code} size={26} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--admin-text)] truncate">
                        {lang.name}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wide admin-text-subtle">
                        {lang.code}
                      </span>
                    </div>
                    <p className="text-xs admin-text-muted truncate">{lang.nativeName}</p>
                    <span
                      className="inline-flex mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
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

                  {already ? (
                    <span className="text-xs font-medium admin-text-muted shrink-0 px-2">Eklendi</span>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleAdd(lang)}
                      disabled={Boolean(saving || pendingCode)}
                      className="!h-9 !px-3 !rounded-xl shrink-0 gap-1"
                    >
                      {busy ? (
                        '…'
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
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
          className="px-5 py-3.5 shrink-0 flex justify-end"
          style={{ borderTop: '1px solid var(--admin-card-border)' }}
        >
          <Button type="button" variant="secondary" onClick={onClose} className="!rounded-xl">
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
