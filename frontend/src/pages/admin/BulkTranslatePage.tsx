import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  FolderTree,
  Globe2,
  Image,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  Package,
  Sparkles,
  BookImage,
} from 'lucide-react';
import { Button, Card, PageHeader, Spinner, Textarea } from '@/components/ui';
import UnlockAddonModal from '@/components/UnlockAddonModal';
import { useAddons } from '@/hooks/useAddons';
import { api } from '@/lib/api';
import { languageFlag } from '@/lib/languageFlags';
import { adminPath } from '@/lib/adminPath';

interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface GapItem {
  id: string;
  entityType: 'group' | 'product' | 'showcase';
  entityId: number;
  field: 'name' | 'description' | 'ingredients' | 'allergens' | 'title1' | 'title2';
  category: 'groups' | 'products' | 'showcase' | 'stories';
  label: string;
  fieldLabel: string;
  sourceLang: string;
  sourceText: string;
  targetLang: string;
  reason?: 'empty' | 'same_as_source';
}

interface PreviewItem extends GapItem {
  translatedText: string;
  error?: string;
}

const CATEGORY_LABELS: Record<GapItem['category'], string> = {
  groups: 'Gruplar',
  products: 'Ürünler',
  showcase: 'Vitrin',
  stories: 'Hikâyeler',
};

const CATEGORY_ICONS: Record<GapItem['category'], typeof Package> = {
  groups: FolderTree,
  products: Package,
  showcase: Image,
  stories: BookImage,
};

const CATEGORY_ORDER: GapItem['category'][] = [
  'groups',
  'products',
  'showcase',
  'stories',
];

const LOADING_LINES = [
  'Lütfen bekleyin…',
  'Çeviriler hazırlanıyor…',
  'Metinler işleniyor…',
  'Neredeyse bitti…',
  'Son dokunuşlar…',
];

export default function BulkTranslatePage() {
  const { isOwned, loading: addonsLoading, unlock, products } = useAddons();
  const langPack = isOwned('lang-pack');
  const packProduct = products.find((p) => p.id === 'lang-pack');

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [targetLang, setTargetLang] = useState('');
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectOpen, setSelectOpen] = useState(false);
  const [selectTab, setSelectTab] = useState<GapItem['category']>('products');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadLineIdx, setLoadLineIdx] = useState(0);
  const [loadTitle, setLoadTitle] = useState('Çeviri sürüyor');

  const busy = previewing || saving;

  const activeLanguages = useMemo(
    () =>
      [...languages.filter((l) => l.isActive && l.code !== 'tr')].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr')
      ),
    [languages]
  );

  const loadLanguages = useCallback(async () => {
    const data = await api<{ languages: Language[] }>('/api/admin/settings');
    setLanguages(data.languages || []);
    const active = (data.languages || []).filter((l) => l.isActive && l.code !== 'tr');
    setTargetLang((prev) => {
      if (prev && prev !== 'tr' && active.some((l) => l.code === prev)) return prev;
      return active[0]?.code || '';
    });
  }, []);

  const loadGaps = useCallback(async (to: string) => {
    if (!to) {
      setGaps([]);
      setCounts({});
      return;
    }
    setLoadingGaps(true);
    try {
      const res = await api<{
        items: GapItem[];
        counts: Record<string, number>;
      }>(`/api/admin/bulk-translate/gaps?to=${encodeURIComponent(to)}`);
      setGaps(res.items);
      setCounts(res.counts || {});
      setSelectedIds(new Set(res.items.map((i) => i.id)));
      const firstWithItems = CATEGORY_ORDER.find((cat) => (res.counts?.[cat] || 0) > 0);
      if (firstWithItems) setSelectTab(firstWithItems);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Eksikler yüklenemedi');
      setGaps([]);
    } finally {
      setLoadingGaps(false);
    }
  }, []);

  useEffect(() => {
    if (!langPack) return;
    loadLanguages().catch(() => setLanguages([]));
  }, [langPack, loadLanguages]);

  useEffect(() => {
    if (!langPack || !targetLang) return;
    setPreview(null);
    loadGaps(targetLang);
  }, [langPack, targetLang, loadGaps]);

  useEffect(() => {
    if (!selectOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectOpen]);

  useEffect(() => {
    if (!busy) {
      setLoadProgress(0);
      return;
    }
    setLoadProgress(6);
    setLoadLineIdx(0);
    const progressTimer = window.setInterval(() => {
      setLoadProgress((p) => {
        if (p >= 92) return p;
        const step = p < 40 ? 4 : p < 70 ? 2.5 : 1.2;
        return Math.min(92, p + step);
      });
    }, 280);
    const lineTimer = window.setInterval(() => {
      setLoadLineIdx((i) => (i + 1) % LOADING_LINES.length);
    }, 1800);
    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(lineTimer);
    };
  }, [busy]);

  async function handleUnlock(code: string) {
    setUnlocking(true);
    try {
      await unlock('lang-pack', code);
      setUnlockOpen(false);
    } finally {
      setUnlocking(false);
    }
  }

  async function applyItems(items: PreviewItem[], lang: string) {
    const payload = items
      .filter((p) => p.translatedText?.trim() && !p.error)
      .map((p) => ({
        id: p.id,
        entityType: p.entityType,
        entityId: p.entityId,
        field: p.field,
        translatedText: p.translatedText.trim(),
      }));
    if (!payload.length) {
      throw new Error('Kaydedilecek çeviri yok');
    }
    return api<{ saved: number; message: string }>('/api/admin/bulk-translate/apply', {
      method: 'POST',
      body: JSON.stringify({ to: lang, items: payload }),
    });
  }

  async function runPreview(ids?: string[]) {
    if (!targetLang || targetLang === 'tr') return;
    setLoadTitle('Çeviri sürüyor');
    setPreviewing(true);
    try {
      const res = await api<{ items: PreviewItem[] }>('/api/admin/bulk-translate/preview', {
        method: 'POST',
        body: JSON.stringify({
          to: targetLang,
          ...(ids ? { ids } : {}),
        }),
      });
      const items = res.items || [];
      const ok = items.filter((p) => p.translatedText?.trim() && !p.error);
      const fail = items.filter((p) => p.error || !p.translatedText?.trim());

      // Hepsi başarılıysa doğrudan kaydet (Latte→Latte dahil onaylanır, sayı düşer)
      if (ok.length && fail.length === 0) {
        setLoadTitle('Çeviriler kaydediliyor');
        setLoadProgress(96);
        const saved = await applyItems(ok, targetLang);
        setLoadProgress(100);
        setPreview(null);
        setSelectOpen(false);
        alert(saved.message || `${saved.saved} çeviri kaydedildi`);
        await loadGaps(targetLang);
        return;
      }

      setLoadProgress(100);
      setPreview(items);
      setSelectOpen(false);
      if (!ok.length) {
        alert('Çeviri alınamadı. OpenAI anahtarını veya bağlantıyı kontrol edin.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Çeviri başlatılamadı');
    } finally {
      window.setTimeout(() => setPreviewing(false), 220);
    }
  }

  async function handleSave() {
    if (!preview?.length || !targetLang) return;
    setLoadTitle('Çeviriler kaydediliyor');
    setSaving(true);
    try {
      const res = await applyItems(preview, targetLang);
      setLoadProgress(100);
      alert(res.message || `${res.saved} çeviri kaydedildi`);
      setPreview(null);
      await loadGaps(targetLang);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      window.setTimeout(() => setSaving(false), 220);
    }
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTabItems(cat: GapItem['category'], on: boolean) {
    const ids = gaps.filter((g) => g.category === cat).map((g) => g.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const tabItems = useMemo(
    () => gaps.filter((g) => g.category === selectTab),
    [gaps, selectTab]
  );

  if (addonsLoading) return <Spinner />;

  if (!langPack) {
    return (
      <div>
        <PageHeader title="Toplu Çeviri" />
        <Card className="p-8 max-w-xl mx-auto text-center space-y-4">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'var(--admin-accent-soft)' }}
          >
            <Lock className="w-6 h-6" style={{ color: 'var(--admin-accent)' }} />
          </div>
          <h2 className="text-lg font-bold text-[var(--admin-text)]">Dil Paketi kilitli</h2>
          <p className="text-sm admin-text-muted leading-relaxed">
            Toplu çeviri ekranı Dil Paketi ile açılır. Eklentiler → Dil bölümünden kod ile
            açabilirsin.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link to={`${adminPath('extensions')}?tab=lang`}>
              <Button type="button" variant="secondary">
                <Globe2 className="w-4 h-4" />
                Eklentilere git
              </Button>
            </Link>
            <Button type="button" onClick={() => setUnlockOpen(true)}>
              <KeyRound className="w-4 h-4" />
              Kod Gir
            </Button>
          </div>
        </Card>
        <UnlockAddonModal
          open={unlockOpen}
          productName={packProduct?.name || 'Dil Paketi'}
          unlocking={unlocking}
          onClose={() => setUnlockOpen(false)}
          onUnlock={handleUnlock}
        />
      </div>
    );
  }

  const totalGaps = gaps.length;
  const targetMeta = activeLanguages.find((l) => l.code === targetLang);

  return (
    <div className="space-y-5">
      <PageHeader title="Toplu Çeviri" />

      <Card className="overflow-hidden">
        <div className="bulk-translate-hero">
          <div className="bulk-translate-hero__glow" aria-hidden />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 p-5 sm:p-6">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="bulk-translate-hero__icon shrink-0">
                <Languages className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--admin-text)] tracking-tight">
                  Eksik çevirileri doldur
                </h2>
                <p className="text-sm admin-text-muted mt-1 leading-relaxed max-w-xl">
                  Hedef dili seç, boş alanları toplu çevir. Yeni dil için{' '}
                  <Link
                    to={`${adminPath('settings')}?focus=languages`}
                    className="font-bold underline underline-offset-2"
                    style={{ color: 'var(--admin-accent)' }}
                  >
                    Ayarlar
                  </Link>
                  ’dan aktif et.
                </p>
                <p className="text-xs admin-text-muted mt-2">
                  Toplam <strong className="text-[var(--admin-text)]">{totalGaps}</strong> eksik
                  alan
                  {targetMeta ? (
                    <>
                      {' '}
                      · Hedef:{' '}
                      <strong className="text-[var(--admin-text)]">
                        {languageFlag(targetMeta.code)} {targetMeta.name}
                      </strong>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full lg:w-auto">
              <Button
                type="button"
                className="flex-1 lg:flex-none"
                disabled={!gaps.length || busy || loadingGaps}
                onClick={() => runPreview()}
              >
                <Languages className="w-4 h-4" />
                Tümünü çevir
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 lg:flex-none"
                disabled={!gaps.length || busy || loadingGaps}
                onClick={() => {
                  setSelectedIds(new Set(gaps.map((g) => g.id)));
                  const firstWithItems = CATEGORY_ORDER.find((cat) => (counts[cat] || 0) > 0);
                  if (firstWithItems) setSelectTab(firstWithItems);
                  setSelectOpen(true);
                }}
              >
                <Check className="w-4 h-4" />
                Seçilileri çevir
              </Button>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide admin-text-muted mb-2.5">
              Hedef dil
              <span className="font-medium normal-case tracking-normal ml-1.5 opacity-70">
                (kaynak: Türkçe)
              </span>
            </p>
            {activeLanguages.length === 0 ? (
              <p className="text-sm admin-text-muted">Aktif dil yok. Ayarlar’dan dil ekleyin.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeLanguages.map((l) => {
                  const active = targetLang === l.code;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={busy}
                      onClick={() => setTargetLang(l.code)}
                      className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-semibold border transition ${
                        active
                          ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white shadow-sm'
                          : 'border-[var(--admin-card-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text)] hover:border-[var(--admin-accent)]'
                      }`}
                    >
                      <span className="text-base leading-none">{languageFlag(l.code)}</span>
                      {l.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loadingGaps ? (
            <div className="py-10 flex justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {CATEGORY_ORDER.map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                const n = counts[cat] || 0;
                return (
                  <div key={cat} className="bulk-translate-stat">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bulk-translate-stat__icon">
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wide admin-text-muted truncate">
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[var(--admin-text)] tabular-nums leading-none">
                      {n}
                    </p>
                    <p className="text-[11px] admin-text-muted mt-1.5">
                      {n === 0 ? 'Tamam' : 'eksik alan'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {!loadingGaps && gaps.length === 0 && targetLang && (
            <div className="rounded-xl px-4 py-3 text-sm text-center admin-text-muted bg-[var(--admin-input-bg)] border border-[var(--admin-card-border)]">
              Bu dilde doldurulacak boş alan yok — her şey hazır.
            </div>
          )}
        </div>
      </Card>

      {preview && (
        <Card className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-[var(--admin-text)] flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
                Onay — çevirileri kontrol et
              </h3>
              <p className="text-xs admin-text-muted mt-1">
                İstersen düzenle, sonra kaydet. Boş veya hatalı satırlar kaydedilmez.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setPreview(null)}
              >
                Vazgeç
              </Button>
              <Button type="button" disabled={saving} onClick={handleSave}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Kaydet
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto admin-scroll pr-1">
            {preview.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-xl p-3 space-y-2"
                style={{
                  border: '1px solid var(--admin-card-border)',
                  background: 'var(--admin-input-bg)',
                }}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[var(--admin-text)]">{item.label}</span>
                  <span className="admin-text-muted">· {item.fieldLabel}</span>
                  <span className="admin-text-muted">
                    · {CATEGORY_LABELS[item.category]}
                  </span>
                  {item.error && (
                    <span className="text-red-500 font-semibold">{item.error}</span>
                  )}
                </div>
                <p className="text-xs admin-text-muted">
                  Kaynak ({item.sourceLang}): {item.sourceText}
                </p>
                <Textarea
                  rows={2}
                  value={item.translatedText}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPreview((prev) =>
                      prev
                        ? prev.map((row, i) =>
                            i === idx ? { ...row, translatedText: value, error: undefined } : row
                          )
                        : prev
                    );
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {busy && (
        <div className="bulk-translate-loading" role="status" aria-live="polite">
          <div className="bulk-translate-loading__card">
            <div className="bulk-translate-loading__orb">
              <Languages className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base font-bold text-[var(--admin-text)] mt-4">{loadTitle}</h3>
            <p className="text-sm admin-text-muted mt-1.5 min-h-[1.25rem]">
              {LOADING_LINES[loadLineIdx]}
            </p>
            <div className="bulk-translate-loading__bar mt-5">
              <div
                className="bulk-translate-loading__fill"
                style={{ width: `${Math.round(loadProgress)}%` }}
              />
            </div>
            <p className="text-xs font-semibold tabular-nums admin-text-muted mt-2">
              %{Math.round(loadProgress)}
            </p>
          </div>
        </div>
      )}

      {selectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
          />
          <div
            className="relative w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-xl"
            style={{
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-card-border)',
              maxHeight: 'min(520px, 85vh)',
            }}
          >
            <div className="px-4 pt-4 pb-3 space-y-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[var(--admin-text)]">Çevrilecekleri seç</h3>
                  <p className="text-xs admin-text-muted mt-0.5">
                    Üstten kategori seç, alttan öğeleri işaretle.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm admin-text-muted shrink-0"
                  onClick={() => setSelectOpen(false)}
                >
                  Kapat
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ORDER.map((cat) => {
                  const count = counts[cat] || 0;
                  const active = selectTab === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={count === 0}
                      onClick={() => setSelectTab(cat)}
                      className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold transition border ${
                        active
                          ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white'
                          : 'border-[var(--admin-card-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text)]'
                      } ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {CATEGORY_LABELS[cat]}
                      <span
                        className={`min-w-[1.1rem] text-center rounded-md px-1 ${
                          active ? 'bg-white/20' : 'bg-[var(--admin-accent-soft)]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] admin-text-muted font-semibold uppercase tracking-wide">
                  {CATEGORY_LABELS[selectTab]}
                </p>
                <button
                  type="button"
                  className="text-xs font-semibold"
                  style={{ color: 'var(--admin-accent)' }}
                  onClick={() => {
                    const allOn = tabItems.every((g) => selectedIds.has(g.id));
                    toggleTabItems(selectTab, !allOn);
                  }}
                  disabled={!tabItems.length}
                >
                  {tabItems.length && tabItems.every((g) => selectedIds.has(g.id))
                    ? 'Hiçbiri'
                    : 'Tümü'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto admin-scroll px-4 pb-2 min-h-0">
              {tabItems.length === 0 ? (
                <p className="text-sm admin-text-muted text-center py-8">Bu kategoride eksik yok.</p>
              ) : (
                <div className="space-y-1">
                  {tabItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-[var(--admin-accent-soft)]/40"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--admin-accent)]"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleId(item.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--admin-text)] truncate">
                          {item.label}
                        </span>
                        <span className="text-[11px] admin-text-muted">
                          {item.fieldLabel} · {item.sourceLang} → {item.targetLang}
                          {item.reason === 'same_as_source' ? ' · kopya metin' : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div
              className="p-4 flex gap-2 shrink-0"
              style={{ borderTop: '1px solid var(--admin-card-border)' }}
            >
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setSelectOpen(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!selectedIds.size || previewing}
                onClick={() => runPreview([...selectedIds])}
              >
                {previewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Languages className="w-4 h-4" />
                )}
                Çevir ({selectedIds.size})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
