import { useEffect, useState } from 'react';
import { Loader2, MessageSquareQuote, Plus, Search, Star, Trash2, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Channel, Field } from './IntegrationsSettings';
import './reviews-integration.css';

type Manual = { name: string; text: string; rating: number };
type Config = {
  googleEnabled: boolean;
  placeId: string;
  placeName: string;
  placeAddress: string;
  manualEnabled: boolean;
  manual: Manual[];
};
type Loaded = { config: Config; keyConfigured: boolean };
type Hit = { id: string; name: string; address: string; rating: number | null; count: number | null };
type TestResult = { name: string; rating: number | null; count: number | null; reviewCount: number; sample: { name: string; text: string; rating: number } | null };

const MAX_MANUAL = 12;
const apiError = (e: unknown) => (e instanceof Error ? e.message : 'İşlem tamamlanamadı.');

/** Entegrasyonlar > Yorumlar: Google yorumları (işletme seçilerek) ve elle girilen müşteri yorumları. */
export default function ReviewsIntegration({ onToast }: { onToast: (text: string, error?: boolean) => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    let alive = true;
    api<Loaded>('/api/admin/settings/reviews')
      .then((r) => {
        if (!alive) return;
        setLoaded(r);
        setDraft(r.config);
      })
      .catch(() => alive && onToast('Yorum ayarları yüklenemedi.', true));
    return () => {
      alive = false;
    };
    // yalnızca açılışta yüklenir (onToast her çizimde değişebilir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded || !draft) {
    return (
      <p className="rvi-loading">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Yorum ayarları yükleniyor…
      </p>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.config);
  const set = (patch: Partial<Config>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await api<Loaded>('/api/admin/settings/reviews', { method: 'PUT', body: JSON.stringify({ config: draft }) });
      setLoaded(res);
      setDraft(res.config);
      onToast('Yorum ayarları kaydedildi.');
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setSaving(false);
    }
  }

  async function search() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await api<Hit[]>(`/api/admin/settings/reviews/search?q=${encodeURIComponent(q)}`);
      setHits(res);
      if (!res.length) setSearchError('İşletme bulunamadı. Adı ve semti birlikte yazmayı deneyin (ör. “Zeen Cafe Kadıköy”).');
    } catch (e) {
      setHits([]);
      setSearchError(apiError(e));
    } finally {
      setSearching(false);
    }
  }

  function pick(hit: Hit) {
    set({ placeId: hit.id, placeName: hit.name, placeAddress: hit.address, googleEnabled: true });
    setHits([]);
    setQuery('');
    setTest(null);
    setTestError('');
  }

  async function runTest() {
    if (!draft?.placeId || testing) return;
    setTesting(true);
    setTest(null);
    setTestError('');
    try {
      setTest(await api<TestResult>('/api/admin/settings/reviews/test', { method: 'POST', body: JSON.stringify({ placeId: draft.placeId }) }));
    } catch (e) {
      setTestError(apiError(e));
    } finally {
      setTesting(false);
    }
  }

  const setManual = (i: number, patch: Partial<Manual>) =>
    setDraft((d) => (d ? { ...d, manual: d.manual.map((m, k) => (k === i ? { ...m, ...patch } : m)) } : d));

  const googleStatus = !loaded.keyConfigured
    ? { tone: 'idle' as const, text: 'Sunucuda Google anahtarı tanımlı değil' }
    : draft.googleEnabled && draft.placeId
      ? { tone: 'ok' as const, text: `Açık · ${draft.placeName || 'işletme seçili'}` }
      : { tone: 'off' as const, text: draft.placeId ? 'Kapalı · işletme seçili' : 'Kapalı · işletme seçilmedi' };
  const manualStatus = draft.manualEnabled
    ? { tone: 'ok' as const, text: `Açık · ${draft.manual.length} yorum` }
    : { tone: 'off' as const, text: 'Kapalı' };

  return (
    <>
      <Channel
        icon={<Star size={22} />}
        title="Google yorumları"
        subtitle="İşletmenizin Google puanı ve yorumları karşılama ve “Daha fazla” ekranında görünür"
        enabled={draft.googleEnabled}
        onEnabled={(v) => set({ googleEnabled: v && Boolean(draft.placeId) })}
        status={googleStatus}
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onReset={() => setDraft(loaded.config)}
      >
        {!loaded.keyConfigured ? (
          <p className="ig-tip">
            Bu özellik için sunucuya Google Places anahtarı eklenmeli (<code>GOOGLE_PLACES_API_KEY</code>). Eklenene kadar Google yorumları gösterilmez; elle girdiğiniz yorumlar çalışmaya devam eder.
          </p>
        ) : null}

        {draft.placeId ? (
          <div className="rvi-place">
            <span aria-hidden="true">
              <Star size={18} />
            </span>
            <div>
              <strong>{draft.placeName || 'Seçili işletme'}</strong>
              {draft.placeAddress ? <small>{draft.placeAddress}</small> : null}
            </div>
            <button type="button" className="ig-link" onClick={() => set({ placeId: '', placeName: '', placeAddress: '', googleEnabled: false })}>
              Değiştir
            </button>
          </div>
        ) : null}

        {!draft.placeId ? (
          <>
            <div className="rvi-search">
              <div onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void search())}>
                <Field label="İşletme adı veya adresi" value={query} onChange={setQuery} placeholder="Zeen Cafe Kadıköy" maxLength={120} />
              </div>
              <button type="button" className="ig-btn" disabled={!loaded.keyConfigured || searching || query.trim().length < 2} onClick={() => void search()}>
                {searching ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />} Ara
              </button>
            </div>
            {searchError ? <p className="rvi-error">{searchError}</p> : null}
            {hits.length ? (
              <ul className="rvi-hits">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => pick(h)}>
                      <strong>{h.name}</strong>
                      <small>{h.address}</small>
                      {h.rating !== null ? (
                        <em>
                          ★ {h.rating.toFixed(1)} {h.count ? `· ${h.count} yorum` : ''}
                        </em>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="rvi-test">
            <button type="button" className="ig-btn ig-btn--ghost" disabled={testing || !loaded.keyConfigured} onClick={() => void runTest()}>
              {testing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Zap size={16} aria-hidden />} Bağlantıyı dene
            </button>
            {test ? (
              <p className="rvi-ok">
                Bağlandı: {test.name}
                {test.rating !== null ? ` · ★ ${test.rating.toFixed(1)}` : ''}
                {test.count ? ` · ${test.count} yorum` : ''} · {test.reviewCount} yorum okundu
                {test.sample ? <em>“{test.sample.text.slice(0, 90)}{test.sample.text.length > 90 ? '…' : ''}” — {test.sample.name}</em> : null}
              </p>
            ) : null}
            {testError ? <p className="rvi-error">{testError}</p> : null}
          </div>
        )}
        <p className="ig-tip">Google en fazla 5 yorum verir; puan ve yorum sayısı tamdır. Yorumlar saklanmaz, 6 saatte bir Google’dan tazelenir.</p>
      </Channel>

      <Channel
        icon={<MessageSquareQuote size={22} />}
        title="Müşteri yorumları (elle)"
        subtitle="Gerçekten aldığınız güzel sözleri kendiniz yazın; “Misafirlerimizden” etiketiyle görünür"
        enabled={draft.manualEnabled}
        onEnabled={(v) => set({ manualEnabled: v })}
        status={manualStatus}
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onReset={() => setDraft(loaded.config)}
      >
        <p className="ig-tip">Yalnızca müşterilerinizin gerçekten söylediği ya da yazdığı yorumları ekleyin. Uydurma yorum yanıltıcıdır ve işletmenizi riske atar.</p>
        <ul className="rvi-list">
          {draft.manual.map((m, i) => (
            <li key={i} className="rvi-item">
              <div className="rvi-item__top">
                <Field label="Müşteri adı" value={m.name} onChange={(v) => setManual(i, { name: v })} maxLength={40} />
                <div className="rvi-rate" role="radiogroup" aria-label="Puan">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={m.rating === n} className={n <= m.rating ? 'is-on' : ''} onClick={() => setManual(i, { rating: n })} aria-label={`${n} yıldız`}>
                      <Star size={18} fill={n <= m.rating ? 'currentColor' : 'none'} aria-hidden />
                    </button>
                  ))}
                </div>
                <button type="button" className="rvi-del" aria-label="Yorumu sil" onClick={() => set({ manual: draft.manual.filter((_, k) => k !== i) })}>
                  <Trash2 size={17} aria-hidden />
                </button>
              </div>
              <textarea value={m.text} maxLength={300} rows={2} placeholder="Yorum metni" aria-label="Yorum metni" onChange={(e) => setManual(i, { text: e.target.value })} />
              <small>{m.text.length}/300</small>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ig-btn ig-btn--ghost"
          disabled={draft.manual.length >= MAX_MANUAL}
          onClick={() => set({ manual: [...draft.manual, { name: '', text: '', rating: 5 }] })}
        >
          <Plus size={16} aria-hidden /> {draft.manual.length >= MAX_MANUAL ? `En fazla ${MAX_MANUAL} yorum` : 'Yorum ekle'}
        </button>
        <p className="ig-tip">Adı ya da metni boş bırakılan satırlar kaydedilirken atılır.</p>
      </Channel>
    </>
  );
}
