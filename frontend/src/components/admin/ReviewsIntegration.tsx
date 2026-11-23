import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquareQuote, Plus, Search, Star, Trash2, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Channel, Field } from './IntegrationsSettings';
import { notifyReviewsChanged } from '@/lib/reviews';
import './reviews-integration.css';

type Manual = { name: string; text: string; rating: number };
export type ReviewsDraft = {
  googleEnabled: boolean;
  placeId: string;
  placeName: string;
  placeAddress: string;
  manualEnabled: boolean;
  manual: Manual[];
};
type Loaded = { config: ReviewsDraft; keyConfigured: boolean };
type Hit = { id: string; name: string; address: string; rating: number | null; count: number | null };
type TestResult = { name: string; rating: number | null; count: number | null; reviewCount: number; sample: { name: string; text: string; rating: number } | null };
type Status = { tone: 'ok' | 'idle' | 'off'; text: string };

const MAX_MANUAL = 12;
const apiError = (e: unknown) => (e instanceof Error ? e.message : 'İşlem tamamlanamadı.');

/** Yorum ayarlarının tek kaynağı: Google ve elle yorumlar aynı taslağı paylaşır, tek istekle kaydedilir. */
export function useReviewsState(onToast: (text: string, error?: boolean) => void) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<ReviewsDraft | null>(null);
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

  const ready = Boolean(loaded && draft);
  const dirty = ready && JSON.stringify(draft) !== JSON.stringify(loaded!.config);
  const set = (patch: Partial<ReviewsDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const keyConfigured = loaded?.keyConfigured ?? false;

  const writeLock = useRef(false);
  async function toggle(channel: 'manualEnabled' | 'googleEnabled', enabled: boolean) {
    if (!draft || !loaded || writeLock.current) return;
    writeLock.current = true;
    setSaving(true);
    try {
      const res = await api<Loaded>('/api/admin/settings/reviews', {
        method: 'PATCH', body: JSON.stringify({ channel, enabled }),
      });
      setLoaded(res);
      setDraft((d) => d ? { ...d, [channel]: res.config[channel] } : d);
      notifyReviewsChanged();
      onToast(enabled ? 'Yorumlar menüde gösteriliyor.' : 'Yorumlar menüden gizlendi.');
    } catch (e) { onToast(apiError(e), true); }
    finally { writeLock.current = false; setSaving(false); }
  }

  async function save() {
    if (!draft || writeLock.current) return;
    writeLock.current = true;
    setSaving(true);
    try {
      const res = await api<Loaded>('/api/admin/settings/reviews', { method: 'PUT', body: JSON.stringify({ config: draft }) });
      setLoaded(res);
      setDraft(res.config);
      notifyReviewsChanged();
      onToast('Yorum ayarları kaydedildi.');
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      writeLock.current = false;
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

  const googleStatus: Status = !draft
    ? { tone: 'off', text: 'Yükleniyor…' }
    : !keyConfigured
      ? { tone: 'idle', text: 'Sunucuda Google anahtarı tanımlı değil' }
      : draft.googleEnabled && draft.placeId
        ? { tone: 'ok', text: `Açık · ${draft.placeName || 'işletme seçili'}` }
        : { tone: 'off', text: draft.placeId ? 'Kapalı · işletme seçili' : 'Kapalı · işletme seçilmedi' };
  const manualStatus: Status = !draft
    ? { tone: 'off', text: 'Yükleniyor…' }
    : draft.manualEnabled
      ? { tone: 'ok', text: `Açık · ${draft.manual.length} yorum` }
      : { tone: 'off', text: 'Kapalı' };

  return {
    ready, loaded, draft, dirty, saving, keyConfigured, set, setManual, save, toggle, reset: () => loaded && setDraft(loaded.config),
    query, setQuery, hits, searching, searchError, search, pick, testing, test, testError, runTest,
    googleStatus, manualStatus,
  };
}
export type ReviewsState = ReturnType<typeof useReviewsState>;

/** İki yorum kanalından biri: "google" ya da "manual". */
export function ReviewsChannel({ s, part }: { s: ReviewsState; part: 'google' | 'manual' }) {
  const { draft } = s;
  if (!s.ready || !draft) {
    return (
      <p className="rvi-loading">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Yorum ayarları yükleniyor…
      </p>
    );
  }

  if (part === 'google') {
    return (
      <Channel
        icon={<Star size={22} />}
        title="Google yorumları"
        subtitle="Google puanınız ve yorumlarınız karşılama ve “Daha fazla” ekranında görünür"
        enabled={draft.googleEnabled}
        onEnabled={(v) => void s.toggle('googleEnabled', v)}
        status={s.googleStatus}
        dirty={s.dirty}
        saving={s.saving}
        onSave={() => void s.save()}
        onReset={s.reset}
      >
        {!s.keyConfigured ? (
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
            <button type="button" className="ig-link" onClick={() => s.set({ placeId: '', placeName: '', placeAddress: '', googleEnabled: false })}>
              Değiştir
            </button>
          </div>
        ) : null}

        {!draft.placeId ? (
          <>
            <div className="rvi-search">
              <div onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void s.search())}>
                <Field label="İşletme adı veya adresi" value={s.query} onChange={s.setQuery} placeholder="Zeen Cafe Kadıköy" maxLength={120} />
              </div>
              <button type="button" className="ig-btn" disabled={!s.keyConfigured || s.searching || s.query.trim().length < 2} onClick={() => void s.search()}>
                {s.searching ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />} Ara
              </button>
            </div>
            {s.searchError ? <p className="rvi-error">{s.searchError}</p> : null}
            {s.hits.length ? (
              <ul className="rvi-hits">
                {s.hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => s.pick(h)}>
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
            <button type="button" className="ig-btn ig-btn--ghost" disabled={s.testing || !s.keyConfigured} onClick={() => void s.runTest()}>
              {s.testing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Zap size={16} aria-hidden />} Bağlantıyı dene
            </button>
            {s.test ? (
              <p className="rvi-ok">
                Bağlandı: {s.test.name}
                {s.test.rating !== null ? ` · ★ ${s.test.rating.toFixed(1)}` : ''}
                {s.test.count ? ` · ${s.test.count} yorum` : ''} · {s.test.reviewCount} yorum okundu
                {s.test.sample ? <em>“{s.test.sample.text.slice(0, 90)}{s.test.sample.text.length > 90 ? '…' : ''}” — {s.test.sample.name}</em> : null}
              </p>
            ) : null}
            {s.testError ? <p className="rvi-error">{s.testError}</p> : null}
          </div>
        )}
        <p className="ig-tip">Google en fazla 5 yorum verir; puan ve yorum sayısı tamdır. Yorumlar saklanmaz, 6 saatte bir Google’dan tazelenir.</p>
      </Channel>
    );
  }

  return <ManualChannel s={s} draft={draft} />;
}

function ManualChannel({ s, draft }: { s: ReviewsState; draft: ReviewsDraft }) {
  const list = useRef<HTMLUListElement>(null);
  const count = useRef(draft.manual.length);
  const full = draft.manual.length >= MAX_MANUAL;

  // Yeni yorum eklenince liste en alta kayar ve ad alanına odaklanır
  useEffect(() => {
    if (draft.manual.length > count.current) {
      const el = list.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        const inputs = el.querySelectorAll<HTMLInputElement>('input');
        window.setTimeout(() => inputs[inputs.length - 1]?.focus({ preventScroll: true }), 250);
      }
    }
    count.current = draft.manual.length;
  }, [draft.manual.length]);

  return (
    <Channel
      icon={<MessageSquareQuote size={22} />}
      title="Müşteri yorumları (elle)"
      subtitle="Gerçekten aldığınız güzel sözleri kendiniz yazın; “Misafirlerimizden” etiketiyle görünür"
      enabled={draft.manualEnabled}
      onEnabled={(v) => void s.toggle('manualEnabled', v)}
      status={s.manualStatus}
      dirty={s.dirty}
      saving={s.saving}
      onSave={() => void s.save()}
      onReset={s.reset}
      extra={
        <button
          type="button"
          className="rvi-add"
          disabled={full}
          onClick={() => s.set({ manual: [...draft.manual, { name: '', text: '', rating: 5 }] })}
          aria-label={full ? `En fazla ${MAX_MANUAL} yorum` : 'Yorum ekle'}
        >
          <Plus size={16} aria-hidden /> <span>{full ? `${MAX_MANUAL}/${MAX_MANUAL}` : 'Yorum ekle'}</span>
        </button>
      }
    >
      <div className="rvi-manual">
        <p className="ig-tip">
          Yalnızca müşterilerinizin gerçekten söylediği ya da yazdığı yorumları ekleyin; uydurma yorum yanıltıcıdır ve işletmenizi riske atar. Adı ya da metni boş satırlar kaydedilirken atılır.
          <b className="rvi-count"> {draft.manual.length}/{MAX_MANUAL}</b>
        </p>
        {draft.manual.length ? (
          <ul className="rvi-list" ref={list}>
            {draft.manual.map((m, i) => (
              <li key={i} className="rvi-item">
                <div className="rvi-item__top">
                  <Field label="Müşteri adı" value={m.name} onChange={(v) => s.setManual(i, { name: v })} maxLength={40} />
                  <div className="rvi-rate" role="radiogroup" aria-label="Puan">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={m.rating === n} className={n <= m.rating ? 'is-on' : ''} onClick={() => s.setManual(i, { rating: n })} aria-label={`${n} yıldız`}>
                        <Star size={18} fill={n <= m.rating ? 'currentColor' : 'none'} aria-hidden />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="rvi-del" aria-label="Yorumu sil" onClick={() => s.set({ manual: draft.manual.filter((_, k) => k !== i) })}>
                    <Trash2 size={17} aria-hidden />
                  </button>
                </div>
                <textarea value={m.text} maxLength={300} rows={2} placeholder="Yorum metni" aria-label="Yorum metni" onChange={(e) => s.setManual(i, { text: e.target.value })} />
                <small>{m.text.length}/300</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rvi-empty">Henüz yorum yok. Sağ üstteki “Yorum ekle” ile başlayın.</p>
        )}
      </div>
    </Channel>
  );
}
