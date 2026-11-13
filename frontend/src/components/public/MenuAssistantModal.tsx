import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import SofraSheet from './sofra/SofraSheet';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';

type Hunger = 'light' | 'hungry' | 'stuffed';
type Taste = 'sweet' | 'savory' | 'fresh';
type Budget = 'low' | 'mid' | 'high';

interface SuggestProduct {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
  groupName?: string;
}

interface MenuAssistantModalProps {
  open: boolean;
  slug: string;
  lang: string;
  campaignSlug?: string;
  onClose: () => void;
}

const COPY = {
  tr: {
    title: 'Ne yesem?',
    subtitle: '3 kısa soru — sana özel öneriler',
    q1: 'Ne kadar açsın?',
    q2: 'Ne tarz bir şey istersin?',
    q3: 'Bütçen nasıl?',
    hunger: {
      light: 'Hafif bir şey',
      hungry: 'Normal açım',
      stuffed: 'İyice doyur',
    } as Record<Hunger, string>,
    taste: {
      sweet: 'Tatlı',
      savory: 'Tuzlu / doyurucu',
      fresh: 'Taze / hafif',
    } as Record<Taste, string>,
    budget: {
      low: 'Uygun fiyat',
      mid: 'Orta',
      high: 'Keyfine bak',
    } as Record<Budget, string>,
    next: 'Devam',
    back: 'Geri',
    find: 'Önerileri getir',
    loading: 'Senin için bakıyorum…',
    results: 'Sana yakışanlar',
    empty: 'Uygun ürün bulamadım, menüye göz atabilirsin.',
    again: 'Baştan sor',
    close: 'Kapat',
  },
  en: {
    title: 'What should I eat?',
    subtitle: '3 short questions — picks for you',
    q1: 'How hungry are you?',
    q2: 'What are you craving?',
    q3: 'Budget?',
    hunger: {
      light: 'Something light',
      hungry: 'Normally hungry',
      stuffed: 'Feed me well',
    } as Record<Hunger, string>,
    taste: {
      sweet: 'Sweet',
      savory: 'Savory',
      fresh: 'Fresh / light',
    } as Record<Taste, string>,
    budget: {
      low: 'Budget-friendly',
      mid: 'Mid-range',
      high: 'Treat yourself',
    } as Record<Budget, string>,
    next: 'Next',
    back: 'Back',
    find: 'Show picks',
    loading: 'Looking for you…',
    results: 'Picked for you',
    empty: 'No matches — browse the menu.',
    again: 'Ask again',
    close: 'Close',
  },
};

function ui(lang: string) {
  const code = (lang || 'tr').split('-')[0];
  return code === 'en' ? COPY.en : COPY.tr;
}

export default function MenuAssistantModal({
  open,
  slug,
  lang,
  campaignSlug = '',
  onClose,
}: MenuAssistantModalProps) {
  const t = ui(lang);
  const [step, setStep] = useState(0);
  const [hunger, setHunger] = useState<Hunger | null>(null);
  const [taste, setTaste] = useState<Taste | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SuggestProduct[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    request.current += 1;
    if (!open) return;
    setError(false);
    setStep(0);
    setHunger(null);
    setTaste(null);
    setBudget(null);
    setProducts([]);
    setDone(false);
    setLoading(false);
  }, [open]);

  async function fetchSuggestions(h: Hunger, ta: Taste, b: Budget) {
    const id = ++request.current;
    setError(false);
    setLoading(true);
    setDone(false);
    try {
      const params = new URLSearchParams({
        hunger: h,
        taste: ta,
        budget: b,
        lang,
      });
      if (campaignSlug) params.set('kampanya', campaignSlug);
      const res = await api<{ products: SuggestProduct[] }>(
        `/api/menu/${slug}/assistant-suggest?${params}`
      );
      if (id !== request.current) return;
      setProducts(res.products || []);
      setDone(true);
    } catch {
      if (id !== request.current) return;
      setError(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  function reset() {
    setError(false);
    setStep(0);
    setHunger(null);
    setTaste(null);
    setBudget(null);
    setProducts([]);
    setDone(false);
  }

  return (
    <SofraSheet open={open} onClose={onClose} title={t.title} subtitle={t.subtitle}>
      <div className="sofra-assistant">
        {error && (
          <p className="sofra-sheet-error" role="alert">
            {lang.startsWith('en')
              ? 'Could not load picks. Please try again.'
              : 'Öneriler yüklenemedi. Lütfen tekrar deneyin.'}
          </p>
        )}
        {!done && !loading && (
          <>
            <div className="menu-assistant-steps" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i <= step ? 'is-on' : ''} />
              ))}
            </div>

            <h3>{step === 0 ? t.q1 : step === 1 ? t.q2 : t.q3}</h3>
            {step === 0 && (
              <div className="menu-assistant-choices">
                {(Object.keys(t.hunger) as Hunger[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={hunger === key}
                    className={`menu-assistant-choice${hunger === key ? ' is-active' : ''}`}
                    onClick={() => setHunger(key)}
                  >
                    {t.hunger[key]}
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="menu-assistant-choices">
                {(Object.keys(t.taste) as Taste[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={taste === key}
                    className={`menu-assistant-choice${taste === key ? ' is-active' : ''}`}
                    onClick={() => setTaste(key)}
                  >
                    {t.taste[key]}
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <div className="menu-assistant-choices">
                {(Object.keys(t.budget) as Budget[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={budget === key}
                    className={`menu-assistant-choice${budget === key ? ' is-active' : ''}`}
                    onClick={() => setBudget(key)}
                  >
                    {t.budget[key]}
                  </button>
                ))}
              </div>
            )}

            <div className="menu-assistant-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="menu-assistant-btn menu-assistant-btn--ghost"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.back}
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  className="menu-assistant-btn"
                  disabled={step === 0 ? !hunger : !taste}
                  onClick={() => setStep((s) => s + 1)}
                >
                  {t.next}
                </button>
              ) : (
                <button
                  type="button"
                  className="menu-assistant-btn"
                  disabled={!budget || !hunger || !taste}
                  onClick={() => {
                    if (hunger && taste && budget) void fetchSuggestions(hunger, taste, budget);
                  }}
                >
                  {t.find}
                </button>
              )}
            </div>
          </>
        )}

        {loading && (
          <div className="menu-assistant-loading" role="status">
            {t.loading}
            <span className="menu-assistant-loading__dot" />
            <span className="menu-assistant-loading__dot" />
            <span className="menu-assistant-loading__dot" />
          </div>
        )}

        {done && !loading && (
          <>
            {products.length === 0 ? (
              <p className="menu-assistant-empty">{t.empty}</p>
            ) : (
              <div className="menu-assistant-results">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    to={menuProductPath(p.id)}
                    className="menu-assistant-result"
                    onClick={onClose}
                  >
                    {p.imageUrl ? (
                      <img src={imageUrl(p.imageUrl)} alt="" />
                    ) : (
                      <div className="menu-assistant-result__ph">
                        <MenuMediaPlaceholder kind="product" size="sm" label={p.name} />
                      </div>
                    )}
                    <div className="menu-assistant-result__meta">
                      <strong>{p.name}</strong>
                      {p.groupName ? <span>{p.groupName}</span> : null}
                    </div>
                    <em>{formatMoney(p.price, p.currency)}</em>
                  </Link>
                ))}
              </div>
            )}
            <div className="menu-assistant-actions">
              <button
                type="button"
                className="menu-assistant-btn menu-assistant-btn--ghost"
                onClick={reset}
              >
                {t.again}
              </button>
              <button type="button" className="menu-assistant-btn" onClick={onClose}>
                {t.close}
              </button>
            </div>
          </>
        )}
      </div>
    </SofraSheet>
  );
}
