import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Plus,
  BookImage,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  IdCard,
  Info,
  ListChecks,
  MessageSquareQuote,
  Megaphone,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import AdminToast from '@/components/admin/AdminToast';
import AdminConfirmModal from '@/components/AdminConfirmModal';
import { Button, PageHeader, Spinner, Textarea } from '@/components/ui';
import UnlockAddonModal from '@/components/UnlockAddonModal';
import { useAddons } from '@/hooks/useAddons';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import LanguageFlag from '@/components/LanguageFlag';
import './bulk-translate.css';

interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

type Category =
  | 'groups'
  | 'products'
  | 'options'
  | 'showcase'
  | 'stories'
  | 'sofra'
  | 'about'
  | 'contact'
  | 'reviews'
  | 'campaigns';

interface OverviewRow {
  code: string;
  name: string;
  total: number;
  missing: number;
  percent: number;
  missingByCategory: Record<string, number>;
  totals: Record<string, number>;
}

interface GapItem {
  id: string;
  entityType: 'group' | 'product' | 'showcase' | 'sofra' | 'dict';
  entityId: number;
  field: string;
  key?: string;
  category: Category;
  label: string;
  fieldLabel: string;
  sourceLang: string;
  sourceText: string;
  targetLang: string;
  reason?: 'empty' | 'same_as_source' | 'stale';
}

interface PreviewItem extends GapItem {
  translatedText: string;
  error?: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  groups: 'Gruplar',
  products: 'Ürünler',
  options: 'Seçenekler',
  showcase: 'Vitrin',
  stories: 'Hikâyeler',
  sofra: 'Karşılama ve menü metinleri',
  about: 'Hakkımızda',
  contact: 'İletişim kartı',
  reviews: 'Müşteri yorumları',
  campaigns: 'Kampanyalar',
};

const CATEGORY_SHORT: Record<Category, string> = {
  groups: 'Gruplar',
  products: 'Ürünler',
  options: 'Seçenekler',
  showcase: 'Vitrin',
  stories: 'Hikâyeler',
  sofra: 'Karşılama',
  about: 'Hakkımızda',
  contact: 'İletişim',
  reviews: 'Yorumlar',
  campaigns: 'Kampanya',
};

const CATEGORY_ICONS: Record<Category, typeof Package> = {
  groups: FolderTree,
  products: Package,
  options: ListChecks,
  showcase: Image,
  stories: BookImage,
  sofra: Sparkles,
  about: Info,
  contact: IdCard,
  reviews: MessageSquareQuote,
  campaigns: Megaphone,
};

const CATEGORY_ORDER: Category[] = [
  'groups',
  'products',
  'options',
  'showcase',
  'stories',
  'sofra',
  'about',
  'contact',
  'reviews',
  'campaigns',
];

const REASON_LABEL: Record<string, string> = {
  same_as_source: 'Kaynakla aynı',
  stale: 'Kaynak değişti',
};

const BATCH = 15;

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
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [gapsFailed, setGapsFailed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectTab, setSelectTab] = useState<Category>('products');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [loadTitle, setLoadTitle] = useState('Çeviri sürüyor');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const gapsRequest = useRef(0);
  const operationBusy = useRef(false);
  const reviewRef = useRef<HTMLElement>(null);

  const busy = previewing || saving;
  const hasPreview = Boolean(preview?.length);

  useEffect(() => {
    if (!hasPreview || busy) return;
    reviewRef.current?.focus({ preventScroll: true });
    reviewRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }, [hasPreview, busy]);

  const activeLanguages = useMemo(
    () =>
      [...languages.filter((l) => l.isActive && l.code !== 'tr')].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr')
      ),
    [languages]
  );

  const loadOverview = useCallback(async () => {
    try {
      const res = await api<{ languages: OverviewRow[] }>('/api/admin/bulk-translate/overview');
      setOverview(res.languages || []);
    } catch {
      setOverview([]);
    }
  }, []);

  const loadLanguages = useCallback(async () => {
    // Doğrudan veritabanından: yeni eklenen/silinen dil hemen görünsün
    const list = await api<Language[]>('/api/admin/languages');
    setLanguages(list || []);
    const active = (list || []).filter((l) => l.isActive && l.code !== 'tr');
    setTargetLang((prev) => {
      if (prev && prev !== 'tr' && active.some((l) => l.code === prev)) return prev;
      return active[0]?.code || '';
    });
  }, []);

  const loadGaps = useCallback(async (to: string) => {
    const request = ++gapsRequest.current;
    setGaps([]);
    setCounts({});
    setTotals({});
    setSearch('');
    setSelectedIds(new Set());
    setGapsFailed(false);
    if (!to) {
      setLoadingGaps(false);
      return;
    }
    setLoadingGaps(true);
    try {
      const res = await api<{
        items: GapItem[];
        counts: Record<string, number>;
        totals: Record<string, number>;
      }>(`/api/admin/bulk-translate/gaps?to=${encodeURIComponent(to)}`);
      if (request !== gapsRequest.current) return;
      setGaps(res.items);
      setCounts(res.counts || {});
      setTotals(res.totals || {});
      setSelectedIds(new Set(res.items.map((i) => i.id)));
      const firstWithItems = CATEGORY_ORDER.find((cat) => (res.counts?.[cat] || 0) > 0);
      if (firstWithItems) setSelectTab(firstWithItems);
    } catch (err) {
      if (request === gapsRequest.current) {
        setGapsFailed(true);
        setNotice({ error: true, text: err instanceof Error ? err.message : 'Eksikler yüklenemedi' });
      }
    } finally {
      if (request === gapsRequest.current) setLoadingGaps(false);
    }
  }, []);

  useEffect(() => {
    if (!langPack) return;
    loadLanguages().catch(() => {
      setLanguages([]);
      setNotice({ error: true, text: 'Diller yüklenemedi. Sayfayı yenileyerek tekrar deneyin.' });
    });
  }, [langPack, loadLanguages]);

  useEffect(() => {
    if (!langPack) return;
    void loadOverview();
    const onFocus = () => {
      if (!operationBusy.current) {
        void loadLanguages().catch(() => undefined);
        void loadOverview();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [langPack, loadOverview, loadLanguages]);

  useEffect(() => {
    if (!langPack || !targetLang) return;
    setPreview(null);
    setNotice(null);
    loadGaps(targetLang);
  }, [langPack, targetLang, loadGaps]);

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
        ...(p.key ? { key: p.key } : {}),
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
    if (!targetLang || targetLang === 'tr' || operationBusy.current || loadingGaps) return;
    operationBusy.current = true;
    setNotice(null);
    setPreview(null);
    setLoadTitle('Çeviri sürüyor');
    setPreviewing(true);
    try {
      // Çok sayıda alan tek istekte zaman aşımına uğramasın: parça parça çevrilir, ilerleme gösterilir
      const wanted = ids ?? gaps.map((g) => g.id);
      const items: PreviewItem[] = [];
      for (let i = 0; i < wanted.length; i += BATCH) {
        setProgress({ done: i, total: wanted.length });
        const res = await api<{ items: PreviewItem[] }>('/api/admin/bulk-translate/preview', {
          method: 'POST',
          body: JSON.stringify({ to: targetLang, ids: wanted.slice(i, i + BATCH) }),
        });
        items.push(...(res.items || []));
      }
      setProgress({ done: wanted.length, total: wanted.length });
      const ok = items.filter((p) => p.translatedText?.trim() && !p.error);
      const fail = items.filter((p) => p.error || !p.translatedText?.trim());

      // Hepsi başarılıysa doğrudan kaydet (Latte→Latte dahil onaylanır, sayı düşer)
      if (ok.length && fail.length === 0) {
        setLoadTitle('Çeviriler kaydediliyor');
        setPreview(items);
        const saved = await applyItems(ok, targetLang);
        setPreview(null);
        setNotice({ error: false, text: saved.message || `${saved.saved} çeviri kaydedildi` });
        await loadGaps(targetLang);
        return;
      }

      setPreview(items);
      if (!ok.length) {
        setNotice({ error: true, text: 'Çeviri alınamadı. OpenAI anahtarını veya bağlantıyı kontrol edin.' });
      }
    } catch (err) {
      setNotice({ error: true, text: err instanceof Error ? err.message : 'Çeviri başlatılamadı' });
    } finally {
      operationBusy.current = false;
      setPreviewing(false);
      setProgress(null);
      void loadOverview();
    }
  }

  async function handleSave() {
    if (!preview?.length || !targetLang || operationBusy.current) return;
    operationBusy.current = true;
    setNotice(null);
    setLoadTitle('Çeviriler kaydediliyor');
    setSaving(true);
    try {
      const res = await applyItems(preview, targetLang);
      setNotice({ error: false, text: res.message || `${res.saved} çeviri kaydedildi` });
      setPreview(null);
      await loadGaps(targetLang);
      void loadOverview();
    } catch (err) {
      setNotice({ error: true, text: err instanceof Error ? err.message : 'Kayıt başarısız' });
    } finally {
      operationBusy.current = false;
      setSaving(false);
    }
  }

  async function resetLanguage() {
    if (!targetLang || operationBusy.current) return;
    operationBusy.current = true;
    setLoadTitle('Çeviriler siliniyor');
    setSaving(true);
    try {
      await api('/api/admin/bulk-translate/reset', { method: 'POST', body: JSON.stringify({ to: targetLang }) });
      setResetOpen(false);
      setPreview(null);
      setNotice({ error: false, text: 'Bu dilin çevirileri silindi. Baştan çevirebilirsiniz.' });
      await loadGaps(targetLang);
      void loadOverview();
    } catch (err) {
      setNotice({ error: true, text: err instanceof Error ? err.message : 'Sıfırlanamadı' });
    } finally {
      operationBusy.current = false;
      setSaving(false);
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

  function toggleTabItems(cat: Category, on: boolean) {
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

  const tabItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return gaps.filter(
      (g) =>
        g.category === selectTab &&
        (!q || `${g.label} ${g.sourceText} ${g.fieldLabel}`.toLocaleLowerCase('tr').includes(q)),
    );
  }, [gaps, selectTab, search]);
  const visibleCategories = CATEGORY_ORDER.filter((c) => (totals[c] || 0) > 0 || (counts[c] || 0) > 0);
  const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
  const percentAll = totalAll ? Math.round(((totalAll - gaps.length) / totalAll) * 100) : 100;

  if (addonsLoading) return <Spinner />;

  if (!langPack) {
    return (
      <div className="translate-page">
        <PageHeader title="Toplu Çeviri" />
        <section className="translate-locked">
          <span className="translate-symbol"><Languages size={28} /></span>
          <p className="translate-eyebrow">BİR MENÜ. BİRÇOK DİL.</p>
          <h2>Her misafire kendi dilinde.</h2>
          <p>Menünüzün eksik çevirilerini tek yerden tamamlayın.<br />Başlamak için Dil Paketi’ni etkinleştirin.</p>
          <div className="translate-locked__actions">
            <Button onClick={() => setUnlockOpen(true)}><KeyRound size={16} /> Aktivasyon kodu gir</Button>
            <Link to={`${adminPath('extensions')}?tab=lang`}>Dil Paketi’ni incele <ArrowUpRight size={15} /></Link>
          </div>
          <span className="translate-locked__note"><Lock size={13} /> Dil Paketi gerekli</span>
        </section>
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

  const targetMeta = activeLanguages.find((l) => l.code === targetLang);
  const allTabSelected = tabItems.length > 0 && tabItems.every((g) => selectedIds.has(g.id));
  const validPreviewCount = preview?.filter((p) => p.translatedText.trim() && !p.error).length || 0;

  return (
    <div className="translate-page">
      <PageHeader title="Toplu Çeviri" subtitle="Menünüzdeki eksik çevirileri tamamlayın." />

      <AdminToast notice={notice} onClose={() => setNotice(null)} />

      <section className="translate-workspace" aria-label="Çeviri çalışma alanı" aria-busy={busy} inert={busy}>
        <aside className="translate-languages">
          <div className="translate-languages__heading">
            <span className="translate-eyebrow">HEDEF DİL</span>
            <span className="translate-language-count">{activeLanguages.length}</span>
          </div>
          <div className="translate-languages__list" aria-label="Hedef diller">
            {activeLanguages.map((lang) => (
              <button
                key={lang.id}
                type="button"
                className={`translate-language ${targetLang === lang.code ? 'is-active' : ''}`}
                aria-pressed={targetLang === lang.code}
                disabled={busy}
                onClick={() => { if (targetLang !== lang.code) setTargetLang(lang.code); }}
              >
                <LanguageFlag code={lang.code} size={23} />
                <span>{lang.name}<small>{lang.code.toUpperCase()}</small></span>
                {(() => {
                  const o = overview.find((r) => r.code === lang.code);
                  if (!o) return targetLang === lang.code ? <Check size={16} /> : null;
                  return (
                    <em className={`translate-pct${o.percent >= 100 ? ' is-done' : ''}`} style={{ ['--p' as string]: o.percent }} title={`${o.missing} alan eksik`}>
                      {o.percent >= 100 ? <Check size={11} strokeWidth={3} /> : <b>{o.percent}</b>}
                    </em>
                  );
                })()}
              </button>
            ))}
            {!activeLanguages.length && <p className="translate-muted-note">Henüz aktif bir hedef dil yok.</p>}
          </div>
          <Link className="translate-settings-link" to={`${adminPath('settings')}?focus=languages`}>
            <Plus size={15} /> Dil ekle veya yönet <ArrowUpRight size={14} />
          </Link>
        </aside>

        <div className="translate-content">
          <div className="translate-content__heading">
            <div>
              <h3>Çeviri bekleyenler</h3>
              <p>{loadingGaps ? 'Eksik alanlar taranıyor…' : `${gaps.length} alan${targetMeta ? ` · ${targetMeta.name}` : ''}`}</p>
            </div>
            <span className="translate-source"><Languages size={15} /> Kaynak: Türkçe</span>
          </div>

          {targetLang && !loadingGaps && !gapsFailed ? (
            <div className="translate-summary">
              <div className="translate-summary__bar" aria-hidden="true">
                <i style={{ width: `${percentAll}%` }} />
              </div>
              <span>
                <strong>%{percentAll}</strong> tamam · {gaps.length ? `${gaps.length} alan eksik` : 'her şey çevrili'} · toplam {totalAll} alan
              </span>
              <button type="button" className="translate-reset" disabled={busy} onClick={() => setResetOpen(true)}>
                <RotateCcw size={14} /> Çevirileri sıfırla
              </button>
            </div>
          ) : null}

          <div className="translate-categories" role="tablist" aria-label="İçerik türü">
            {visibleCategories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  id={`translate-tab-${cat}`}
                  type="button"
                  role="tab"
                  aria-selected={selectTab === cat}
                  aria-controls="translate-items"
                  tabIndex={selectTab === cat ? 0 : -1}
                  disabled={busy || loadingGaps}
                  className={selectTab === cat ? 'is-active' : ''}
                  onClick={() => setSelectTab(cat)}
                  onKeyDown={(e) => {
                    const index = visibleCategories.indexOf(cat);
                    const next = e.key === 'ArrowRight' ? (index + 1) % visibleCategories.length
                      : e.key === 'ArrowLeft' ? (index + visibleCategories.length - 1) % visibleCategories.length
                      : e.key === 'Home' ? 0 : e.key === 'End' ? visibleCategories.length - 1 : -1;
                    if (next < 0) return;
                    e.preventDefault();
                    setSelectTab(visibleCategories[next]);
                    document.getElementById(`translate-tab-${visibleCategories[next]}`)?.focus();
                  }}
                >
                  <Icon size={16} /> {CATEGORY_SHORT[cat]} <span className={counts[cat] ? '' : 'is-done'}>{counts[cat] ? counts[cat] : <Check size={11} strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>

          <div id="translate-items" role="tabpanel" aria-labelledby={`translate-tab-${selectTab}`} className="translate-panel">
            {loadingGaps ? (
              <div className="translate-empty" role="status"><Loader2 size={28} className="animate-spin" /><h4>Eksikler kontrol ediliyor</h4><p>Seçtiğiniz dildeki metinler hazırlanıyor.</p></div>
            ) : gapsFailed ? (
              <div className="translate-empty"><AlertCircle size={28} /><h4>Eksikler yüklenemedi.</h4><p>Bağlantıyı kontrol edip yeniden deneyin.</p><Button type="button" variant="secondary" className="mt-4" onClick={() => { setNotice(null); void loadGaps(targetLang); }}>Tekrar dene</Button></div>
            ) : !targetLang ? (
              <div className="translate-empty"><Globe2 size={30} /><h4>Yeni bir dil, yeni misafirler.</h4><p>Ayarlar’dan bir hedef dil etkinleştirerek başlayın.</p><Link to={`${adminPath('settings')}?focus=languages`}>Dil ayarlarına git <ArrowRight size={15} /></Link></div>
            ) : !gaps.length ? (
              <div className="translate-empty"><span className="translate-complete"><Check size={27} /></span><h4>{targetMeta?.name || 'Bu dil'} hazır.</h4><p>Bu dilde tamamlanacak eksik alan bulunmuyor.</p></div>
            ) : !tabItems.length ? (
              <div className="translate-empty"><Check size={28} /><h4>{search.trim() ? 'Aramayla eşleşen yok.' : `${CATEGORY_LABELS[selectTab]} tamam.`}</h4><p>{search.trim() ? 'Başka bir sözcük deneyin.' : 'Diğer kategorilerden devam edebilirsiniz.'}</p></div>
            ) : (
              <>
                <label className="translate-search">
                  <Search size={15} aria-hidden="true" />
                  <input type="search" value={search} placeholder="Bu listede ara" onChange={(e) => setSearch(e.target.value)} />
                </label>
                <div className="translate-list-heading">
                  <label><input type="checkbox" checked={allTabSelected} ref={(node) => { if (node) node.indeterminate = !allTabSelected && tabItems.some((g) => selectedIds.has(g.id)); }} disabled={busy} onChange={(e) => toggleTabItems(selectTab, e.target.checked)} /> Kategorinin tümü</label>
                  <span>{tabItems.filter((g) => selectedIds.has(g.id)).length} / {tabItems.length} seçili</span>
                </div>
                <div className="translate-item-list admin-scroll">
                  {tabItems.map((item) => (
                    <label key={item.id} className={`translate-item ${selectedIds.has(item.id) ? 'is-selected' : ''}`}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} disabled={busy} onChange={() => toggleId(item.id)} />
                      <span className="translate-item__copy"><span className="translate-item__title">{item.label}<small>{item.fieldLabel}</small></span><span className="translate-item__source">{item.sourceText}</span></span>
                      {item.reason && REASON_LABEL[item.reason] ? <span className={`translate-copy-label${item.reason === 'stale' ? ' is-stale' : ''}`}>{REASON_LABEL[item.reason]}</span> : null}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <footer className="translate-footer">
            <div><strong>{selectedIds.size} alan seçili</strong><p>Başarılı çeviriler otomatik kaydedilir.</p></div>
            <div className="translate-footer__actions">
              <button type="button" className="translate-text-button" disabled={!gaps.length || busy || loadingGaps} onClick={() => setSelectedIds(selectedIds.size === gaps.length ? new Set() : new Set(gaps.map((g) => g.id)))}>{selectedIds.size === gaps.length && gaps.length ? 'Seçimi temizle' : 'Tümünü seç'}</button>
              <Button type="button" disabled={!selectedIds.size || busy || loadingGaps || !targetLang || !!preview?.length} onClick={() => runPreview(selectedIds.size === gaps.length ? undefined : [...selectedIds])}>
                <Languages size={16} /> {selectedIds.size === gaps.length ? 'Tümünü çevir' : 'Seçilenleri çevir'} <ArrowRight size={16} />
              </Button>
            </div>
          </footer>
        </div>
      </section>

      {preview && preview.length > 0 && (
        <section ref={reviewRef} tabIndex={-1} className="translate-review" aria-label="Çeviri sonuçları" inert={busy}>
          <header className="translate-review__heading">
            <div><span className="translate-eyebrow">SON KONTROL</span><h3>Birlikte gözden geçirelim.</h3><p>Bazı alanlar tamamlanamadı. Metinleri düzenleyebilir, hazır olanları kaydedebilirsiniz.</p></div>
            <div className="translate-footer__actions">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setPreview(null)}>Vazgeç</Button>
              <Button type="button" disabled={busy || !validPreviewCount} onClick={handleSave}><Check size={16} /> Hazır olanları kaydet ({validPreviewCount})</Button>
            </div>
          </header>
          <div className="translate-review__list admin-scroll">
            {preview.map((item, idx) => (
              <article className="translate-review-item" key={item.id}>
                <div className="translate-review-item__source"><span className="translate-eyebrow">{CATEGORY_LABELS[item.category]} · {item.fieldLabel}</span><h4>{item.label}</h4><p>{item.sourceText}</p><small>Kaynak: {item.sourceLang.toUpperCase()}</small></div>
                <div className="translate-review-item__target">
                  <label htmlFor={`translation-${idx}`}>{targetMeta?.name || targetLang} çevirisi</label>
                  <Textarea id={`translation-${idx}`} rows={3} value={item.translatedText} disabled={busy} aria-invalid={Boolean(item.error)} onChange={(e) => {
                    const value = e.target.value;
                    setPreview((prev) => prev ? prev.map((row, i) => i === idx ? { ...row, translatedText: value, error: undefined } : row) : prev);
                  }} />
                  {item.error && <p className="translate-field-error"><AlertCircle size={13} /> {item.error}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <AdminConfirmModal
        open={resetOpen}
        title="Bu dilin çevirileri silinsin mi?"
        highlight={targetMeta?.name}
        description="Bu dildeki bütün çeviriler (gruplar, ürünler, hikâyeler, karşılama ve tema metinleri, hakkımızda, iletişim…) silinir ve baştan çevrilebilir hâle gelir. Dil listede kalır. Bu işlem geri alınamaz."
        confirmLabel="Çevirileri sil"
        busy={saving}
        onConfirm={() => void resetLanguage()}
        onCancel={() => setResetOpen(false)}
      />

      {busy && (
        <div className="translate-busy" role="status" aria-live="polite">
          <div><span className="translate-symbol"><Loader2 size={28} className="animate-spin" /></span><h3>{loadTitle}</h3>{progress ? (
            <>
              <div className="translate-progress" aria-hidden="true"><i style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} /></div>
              <p>{progress.done} / {progress.total} alan çevrildi</p>
            </>
          ) : (
            <p>İşlem tamamlandığında sonuçlar burada görünecek.</p>
          )}</div>
        </div>
      )}
    </div>
  );
}
