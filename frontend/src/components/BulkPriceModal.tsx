import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Percent,
  Tags,
  X,
} from 'lucide-react';
import { api, formatMoney } from '@/lib/api';
import { Button, Input, Select } from '@/components/ui';

export type BulkPriceDirection = 'up' | 'down';
export type BulkPriceMode = 'percent' | 'fixed';
export type BulkPriceRounding = 'off' | '0.1' | '0.5' | '1' | '5';
export type BulkOptionsAction = 'base_only' | 'base_and_options';
export type BulkScope = 'all' | 'category' | 'selected';

export type BulkPriceApplyResult = {
  ok: true;
  appliedAt: string;
  orderIds: number[];
  updates: {
    id: number;
    price: number;
    previousPrice: number;
    previousPriceAt: string;
  }[];
  skipped: { id: number; name: string; reason: string }[];
};

type GroupOption = {
  id: number;
  name: string;
  isSubGroup?: boolean;
  parentName?: string | null;
};

type ProductPick = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  currency?: { symbol?: string; code?: string } | null;
};

type PreviewLine = {
  id: number;
  name: string;
  groupName: string;
  currency: { code: string; symbol: string };
  oldPrice: number;
  newPrice: number;
  skipped: boolean;
  skipReason: string | null;
  hasOptions: boolean;
};

type PreviewResponse = {
  withOptionsCount: number;
  applyCount: number;
  warnCount: number;
  lines: PreviewLine[];
};

type Step = 'setup' | 'options' | 'confirm';

interface BulkPriceModalProps {
  open: boolean;
  groups: GroupOption[];
  onClose: () => void;
  onApplied: (result: BulkPriceApplyResult) => void | Promise<void>;
}

const ROUNDING_CHOICES: { value: BulkPriceRounding; label: string; hint: string }[] = [
  { value: '0.1', label: '0,10 ₺', hint: 'En yakın 10 kuruş' },
  { value: '0.5', label: '0,50 ₺', hint: 'En yakın yarım lira' },
  { value: '1', label: '1 ₺', hint: 'En yakın tam lira' },
  { value: '5', label: '5 ₺', hint: 'En yakın 5 lira' },
];

export default function BulkPriceModal({
  open,
  groups,
  onClose,
  onApplied,
}: BulkPriceModalProps) {
  const [step, setStep] = useState<Step>('setup');
  const [scope, setScope] = useState<BulkScope>('all');
  const [groupId, setGroupId] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pickList, setPickList] = useState<ProductPick[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickSearch, setPickSearch] = useState('');

  const [direction, setDirection] = useState<BulkPriceDirection>('up');
  const [mode, setMode] = useState<BulkPriceMode>('percent');
  const [value, setValue] = useState('10');
  const [roundingOn, setRoundingOn] = useState(false);
  const [roundingStep, setRoundingStep] = useState<BulkPriceRounding>('1');
  const [optionsAction, setOptionsAction] = useState<BulkOptionsAction | null>(null);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const groupSelectOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.id.toString(),
        label: g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name,
      })),
    [groups]
  );

  const filteredPicks = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    if (!q) return pickList;
    return pickList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.groupName.toLowerCase().includes(q)
    );
  }, [pickList, pickSearch]);

  useEffect(() => {
    if (!open) return;
    setStep('setup');
    setScope('all');
    setGroupId(groups[0]?.id?.toString() || '');
    setSelectedIds([]);
    setPickSearch('');
    setDirection('up');
    setMode('percent');
    setValue('10');
    setRoundingOn(false);
    setRoundingStep('1');
    setOptionsAction(null);
    setPreview(null);
    setError('');
    setLoading(false);
    setApplying(false);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !applying) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, groups, onClose, applying]);

  useEffect(() => {
    if (!open || scope !== 'selected') return;
    let cancelled = false;
    setPickLoading(true);
    api<{ data: ProductPick[] }>('/api/admin/products?limit=500')
      .then((res) => {
        if (!cancelled) setPickList(res.data);
      })
      .catch(() => {
        if (!cancelled) setPickList([]);
      })
      .finally(() => {
        if (!cancelled) setPickLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scope]);

  function buildBody(optsAction: BulkOptionsAction = optionsAction || 'base_only') {
    const num = Number(String(value).replace(',', '.'));
    return {
      scope,
      groupId: scope === 'category' ? Number(groupId) : undefined,
      productIds: scope === 'selected' ? selectedIds : undefined,
      direction,
      mode,
      value: num,
      rounding: roundingOn ? roundingStep : ('off' as BulkPriceRounding),
      optionsAction: optsAction,
    };
  }

  function validateSetup(): string | null {
    const num = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return 'Geçerli bir değer girin';
    if (mode === 'percent' && num > 500) return 'Yüzde en fazla 500 olabilir';
    if (scope === 'category' && !groupId) return 'Kategori seçin';
    if (scope === 'selected' && selectedIds.length === 0) return 'En az bir ürün seçin';
    return null;
  }

  async function goPreview(
    optsAction: BulkOptionsAction = optionsAction || 'base_only',
    forceConfirm = false
  ) {
    const err = validateSetup();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api<PreviewResponse>('/api/admin/products/bulk-price/preview', {
        method: 'POST',
        body: JSON.stringify(buildBody(optsAction)),
      });
      setPreview(res);
      if (!forceConfirm && res.withOptionsCount > 0) {
        setStep('options');
      } else {
        setStep('confirm');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Önizleme alınamadı');
    } finally {
      setLoading(false);
    }
  }

  async function chooseOptions(action: BulkOptionsAction) {
    setOptionsAction(action);
    await goPreview(action, true);
  }

  async function handleApply() {
    if (!preview || applying) return;
    setApplying(true);
    setError('');
    try {
      const res = await api<BulkPriceApplyResult>('/api/admin/products/bulk-price/apply', {
        method: 'POST',
        body: JSON.stringify(buildBody(optionsAction || 'base_only')),
      });
      await onApplied(res);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uygulanamadı');
    } finally {
      setApplying(false);
    }
  }

  function toggleProduct(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!open) return null;

  const valueLabel = mode === 'percent' ? 'Yüzde (%)' : 'Tutar (₺)';
  const changeLabel =
    direction === 'up'
      ? mode === 'percent'
        ? `%${value} zam`
        : `${value} ₺ zam`
      : mode === 'percent'
        ? `%${value} indirim`
        : `${value} ₺ indirim`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" onClick={() => !applying && onClose()} />

      <div
        className="relative w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up overflow-hidden"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
      >
        <div
          className="px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)' }}
              >
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--admin-text)]">Toplu fiyat güncelle</h2>
                <p className="text-xs admin-text-muted mt-0.5 leading-relaxed">
                  {step === 'setup' && 'Kapsam ve zam / indirim ayarlarını seçin'}
                  {step === 'options' && 'Seçenek fiyatı olan ürünler için ne yapılsın?'}
                  {step === 'confirm' && 'Değişiklikleri kontrol edip onaylayın'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !applying && onClose()}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--admin-accent-soft)] transition"
              aria-label="Kapat"
            >
              <X className="w-4 h-4 admin-text-muted" />
            </button>
          </div>

          <div className="flex gap-1.5 mt-4">
            {(['setup', 'options', 'confirm'] as Step[]).map((s, i) => {
              const active = step === s;
              const done =
                (s === 'setup' && step !== 'setup') ||
                (s === 'options' && step === 'confirm');
              const skipOptions = s === 'options' && preview && preview.withOptionsCount === 0;
              if (skipOptions && step === 'confirm') return null;
              return (
                <div
                  key={s}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    background: active || done ? 'var(--admin-accent)' : 'var(--admin-input-bg)',
                    opacity: skipOptions ? 0.35 : 1,
                  }}
                  title={['Ayarlar', 'Seçenekler', 'Onay'][i]}
                />
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto admin-scroll p-5 space-y-4">
          {error && (
            <div className="rounded-2xl px-3.5 py-2.5 text-sm text-red-600 bg-red-500/10 border border-red-500/20">
              {error}
            </div>
          )}

          {step === 'setup' && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                  Kapsam
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'all', label: 'Tüm ürünler' },
                      { id: 'category', label: 'Kategori' },
                      { id: 'selected', label: 'Seçili ürünler' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScope(opt.id)}
                      className="rounded-2xl px-3 py-2.5 text-sm font-medium text-left transition border"
                      style={{
                        borderColor:
                          scope === opt.id ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                        background:
                          scope === opt.id ? 'var(--admin-accent-soft)' : 'var(--admin-input-bg)',
                        color: 'var(--admin-text)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {scope === 'category' && (
                <Select
                  label="Kategori seçin"
                  value={groupId}
                  options={groupSelectOptions}
                  onChange={(e) => setGroupId(e.target.value)}
                />
              )}

              {scope === 'selected' && (
                <div className="space-y-2">
                  <Input
                    label="Ürün ara..."
                    value={pickSearch}
                    onChange={(e) => setPickSearch(e.target.value)}
                  />
                  <div
                    className="max-h-48 overflow-y-auto admin-scroll rounded-2xl border"
                    style={{ borderColor: 'var(--admin-card-border)' }}
                  >
                    {pickLoading ? (
                      <p className="p-3 text-sm admin-text-muted">Yükleniyor…</p>
                    ) : filteredPicks.length === 0 ? (
                      <p className="p-3 text-sm admin-text-muted">Ürün bulunamadı</p>
                    ) : (
                      filteredPicks.map((p) => {
                        const on = selectedIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProduct(p.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-b-0 transition hover:bg-[var(--admin-accent-soft)]/40"
                            style={{ borderColor: 'var(--admin-card-border)' }}
                          >
                            <span
                              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border"
                              style={{
                                borderColor: on ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                                background: on ? 'var(--admin-accent)' : 'transparent',
                                color: on ? '#fff' : 'transparent',
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-[var(--admin-text)] truncate">
                                {p.name}
                              </span>
                              <span className="block text-xs admin-text-muted truncate">
                                {p.groupName}
                              </span>
                            </span>
                            <span className="text-xs font-medium admin-text-muted shrink-0">
                              {formatMoney(p.price, p.currency)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <p className="text-xs admin-text-muted">{selectedIds.length} ürün seçildi</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                  İşlem
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setDirection('up')}
                    className="rounded-2xl px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border transition"
                    style={{
                      borderColor:
                        direction === 'up' ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                      background:
                        direction === 'up' ? 'var(--admin-accent-soft)' : 'var(--admin-input-bg)',
                    }}
                  >
                    <ArrowUp className="w-4 h-4" /> Zam
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('down')}
                    className="rounded-2xl px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border transition"
                    style={{
                      borderColor:
                        direction === 'down' ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                      background:
                        direction === 'down' ? 'var(--admin-accent-soft)' : 'var(--admin-input-bg)',
                    }}
                  >
                    <ArrowDown className="w-4 h-4" /> İndirim
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setMode('percent')}
                    className="rounded-2xl px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border transition"
                    style={{
                      borderColor:
                        mode === 'percent' ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                      background:
                        mode === 'percent' ? 'var(--admin-accent-soft)' : 'var(--admin-input-bg)',
                    }}
                  >
                    <Percent className="w-4 h-4" /> Yüzde
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('fixed')}
                    className="rounded-2xl px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border transition"
                    style={{
                      borderColor:
                        mode === 'fixed' ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                      background:
                        mode === 'fixed' ? 'var(--admin-accent-soft)' : 'var(--admin-input-bg)',
                    }}
                  >
                    ₺ Sabit
                  </button>
                </div>
                <Input
                  label={valueLabel}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                />
              </div>

              <div
                className="rounded-2xl border p-3.5 space-y-3"
                style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-text)]">Yuvarlama</p>
                    <p className="text-xs admin-text-muted mt-0.5">
                      Açıkken sonucu seçtiğiniz adıma yuvarlar
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={roundingOn}
                    onClick={() => setRoundingOn((v) => !v)}
                    className="relative w-11 h-6 rounded-full transition shrink-0"
                    style={{
                      background: roundingOn ? 'var(--admin-accent)' : 'var(--admin-card-border)',
                    }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: roundingOn ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>

                {roundingOn && (
                  <div className="grid grid-cols-2 gap-2">
                    {ROUNDING_CHOICES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setRoundingStep(c.value)}
                        className="rounded-xl px-3 py-2 text-left border transition"
                        style={{
                          borderColor:
                            roundingStep === c.value
                              ? 'var(--admin-accent)'
                              : 'var(--admin-card-border)',
                          background:
                            roundingStep === c.value
                              ? 'var(--admin-accent-soft)'
                              : 'var(--admin-card)',
                        }}
                      >
                        <span className="block text-sm font-semibold text-[var(--admin-text)]">
                          {c.label}
                        </span>
                        <span className="block text-[11px] admin-text-muted">{c.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'options' && preview && (
            <div className="space-y-3">
              <div
                className="rounded-2xl px-3.5 py-3 text-sm"
                style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-text)' }}
              >
                <strong>{preview.withOptionsCount}</strong> üründe varyant / seçenek fiyatı var.
                Bunlara ne yapalım?
              </div>
              <button
                type="button"
                onClick={() => void chooseOptions('base_only')}
                disabled={loading}
                className="w-full rounded-2xl border px-4 py-3.5 text-left transition hover:bg-[var(--admin-accent-soft)]/50"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                <span className="block text-sm font-semibold text-[var(--admin-text)]">
                  Sadece ürün fiyatı
                </span>
                <span className="block text-xs admin-text-muted mt-1">
                  Seçenek ek fiyatları aynı kalsın
                </span>
              </button>
              <button
                type="button"
                onClick={() => void chooseOptions('base_and_options')}
                disabled={loading}
                className="w-full rounded-2xl border px-4 py-3.5 text-left transition hover:bg-[var(--admin-accent-soft)]/50"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                <span className="block text-sm font-semibold text-[var(--admin-text)]">
                  Ürün + seçenek fiyatları
                </span>
                <span className="block text-xs admin-text-muted mt-1">
                  Aynı zam / indirim seçeneklere de uygulansın
                </span>
              </button>
            </div>
          )}

          {step === 'confirm' && preview && (
            <div className="space-y-3">
              <div
                className="rounded-2xl px-3.5 py-3 text-sm flex flex-wrap gap-x-4 gap-y-1"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <span>
                  <strong>{changeLabel}</strong>
                </span>
                <span className="admin-text-muted">
                  {preview.applyCount} ürün güncellenecek
                </span>
                {preview.warnCount > 0 && (
                  <span className="text-amber-600 font-medium">
                    {preview.warnCount} ürün atlanacak
                  </span>
                )}
                {optionsAction === 'base_and_options' && (
                  <span className="admin-text-muted">Seçenek fiyatları dahil</span>
                )}
              </div>

              <div
                className="max-h-64 overflow-y-auto admin-scroll rounded-2xl border"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                {preview.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-start gap-2 px-3 py-2.5 border-b last:border-b-0 text-sm"
                    style={{
                      borderColor: 'var(--admin-card-border)',
                      background: line.skipped ? 'rgba(245, 158, 11, 0.08)' : undefined,
                    }}
                  >
                    {line.skipped ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--admin-text)] truncate">{line.name}</p>
                      <p className="text-xs admin-text-muted">{line.groupName}</p>
                      {line.skipped && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          İndirim sonrası fiyat 0’ın altına düşer — bu ürün atlanacak
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="admin-text-muted line-through text-xs">
                        {formatMoney(line.oldPrice, line.currency)}
                      </p>
                      <p
                        className={`font-semibold ${line.skipped ? 'text-amber-600' : 'text-[var(--admin-text)]'}`}
                      >
                        {formatMoney(line.newPrice, line.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="px-5 py-4 flex gap-2 shrink-0"
          style={{ borderTop: '1px solid var(--admin-card-border)' }}
        >
          {step === 'setup' && (
            <>
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>
                İptal
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={loading}
                onClick={() => {
                  setOptionsAction(null);
                  void goPreview('base_only');
                }}
              >
                {loading ? 'Hesaplanıyor…' : 'Devam'}
              </Button>
            </>
          )}
          {step === 'options' && (
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setStep('setup')}
              disabled={loading}
            >
              Geri
            </Button>
          )}
          {step === 'confirm' && (
            <>
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setPreview(null);
                  setOptionsAction(null);
                  setStep('setup');
                }}
                disabled={applying}
              >
                Geri
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={applying || !preview?.applyCount}
                onClick={() => void handleApply()}
              >
                {applying ? 'Uygulanıyor…' : 'Onaylıyorum'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
