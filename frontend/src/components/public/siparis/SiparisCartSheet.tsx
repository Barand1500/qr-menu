import { usePresenceEntry } from '@/lib/tablePresence';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Printer, ShoppingBag, TriangleAlert, X } from 'lucide-react';
import { formatMoney, imageUrl, api, isCodeRequiredError } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import SiparisKcal from '@/components/public/siparis/SiparisKcal';
import ReceiptPrinter, { PRINT_MS, type ReceiptData, type ReceiptStage } from '@/components/public/siparis/ReceiptPrinter';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { getMenuBrand } from '@/lib/menuBrand';
import { resolveTableContext, formatTableServiceLabel } from '@/lib/tableContext';
import { notifyTableRequestCreated } from '@/lib/tableRequestNotify';
import { notifyWaiterCalled } from '@/lib/menuGames';
import { allergenLabel, loadDietaryPrefs } from '@/lib/dietAllergens';
import { useTableSessionCode } from '@/components/public/TableSessionCodeGate';
import { useSheetPresence, useSheetFocus } from '@/components/public/sofra/SofraSheet';
import './cart-slip.css';

type Ceremony = { open: boolean; stage: ReceiptStage; data: ReceiptData | null; error?: string };
const CLOSED: Ceremony = { open: false, stage: 'processing', data: null };
/** Sunucu yanıtı çok hızlı gelse bile "sipariş alınıyor" anı kısa da olsa görünsün. */
const MIN_PROCESSING_MS = 1100;

type TableRequestResponse = {
  ok: boolean;
  duplicate?: boolean;
  id: number;
  type: string;
  tableNumber: string;
  groupSlug?: string | null;
  note?: string | null;
  orderJson?: string | null;
  createdAt: string;
};

export default function SiparisCartSheet({ lang }: { lang: string }) {
  const { slug: hookSlug } = useMenuSlug();
  const { enabled, items, note, count, totalPrice, totalCalories, sheetOpen, setSheetOpen, setQty, setNote, clear } = useSiparisCart();
  const { ensureUnlocked, markNeedsUnlock } = useTableSessionCode();
  usePresenceEntry('cart', '', enabled && sheetOpen);
  const [tableCtx] = useState(() => resolveTableContext());
  const [busy, setBusy] = useState(false);
  const [ceremony, setCeremony] = useState<Ceremony>(CLOSED);
  const timers = useRef<number[]>([]);
  const mounted = useSheetPresence(enabled && sheetOpen);
  const panelRef = useSheetFocus(enabled && sheetOpen && !ceremony.open, () => setSheetOpen(false));

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const allergyNames = useMemo(() => {
    const prefs = loadDietaryPrefs();
    return prefs.allergens.map((id) => allergenLabel(id, lang)).filter(Boolean);
  }, [lang, sheetOpen, items.length]);

  const en = (lang || 'tr').split('-')[0] === 'en';
  const currency = items[0]?.currency;
  const masaLabel = formatTableServiceLabel(tableCtx.masa, tableCtx.grup);
  const allergyWarning =
    allergyNames.length > 0
      ? en
        ? `Heads up: this menu may include items that trigger your allergies (${allergyNames.join(', ')}). Check each product.`
        : `Uyarı: Seçtiğin alerjenlere (${allergyNames.join(', ')}) dikkat. Bu menüde bunları tetikleyebilecek ürünler olabilir; ürünleri kontrol et.`
      : null;

  async function confirm() {
    if (busy || !hookSlug || !items.length) return;
    setBusy(true);
    try {
      const unlocked = await ensureUnlocked();
      if (!unlocked) return;

      const brand = getMenuBrand(hookSlug);
      const data: ReceiptData = {
        brandName: brand?.name || (en ? 'Order receipt' : 'Sipariş fişi'),
        brandLogo: brand?.logoUrl ?? null,
        tableLabel: masaLabel,
        items: items.map((i) => ({ name: i.name, qty: i.qty, line: formatMoney(i.price * i.qty, i.currency) })),
        total: formatMoney(totalPrice, currency),
        note: note.trim() || undefined,
        orderNo: null,
        at: new Date(),
      };
      setCeremony({ open: true, stage: 'processing', data });
      const startedAt = Date.now();

      const body = {
        type: 'waiter' as const,
        tableNumber: tableCtx.masa,
        groupSlug: tableCtx.grup || undefined,
        note: note.trim() || undefined,
        order: {
          items: items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price, calories: i.calories ?? null })),
          totalPrice,
          totalCalories,
          currency: currency ?? null,
        },
      };
      const post = () => api<TableRequestResponse>(`/api/menu/${hookSlug}/table-request`, { method: 'POST', body: JSON.stringify(body) });

      let res: TableRequestResponse;
      try {
        res = await post();
      } catch (err) {
        if (!isCodeRequiredError(err)) throw err;
        // Masa kodu gerekiyor: kodu soran pencere yazıcının arkasında kalmasın.
        setCeremony(CLOSED);
        markNeedsUnlock();
        if (!(await ensureUnlocked())) return;
        setCeremony({ open: true, stage: 'processing', data });
        res = await post();
      }

      notifyTableRequestCreated({ id: res.id, type: res.type, tableNumber: res.tableNumber, groupSlug: res.groupSlug, note: res.note, orderJson: res.orderJson, createdAt: res.createdAt });
      notifyWaiterCalled({ type: res.type, requestId: res.id, tableNumber: res.tableNumber, duplicate: res.duplicate, lang, silent: true });

      await new Promise((r) => window.setTimeout(r, Math.max(0, MIN_PROCESSING_MS - (Date.now() - startedAt))));
      // Tüm temalar aynı sepeti kullanır: sipariş iletildi, sepet boşalır; fiş artık kendi verisini taşır.
      clear();
      setSheetOpen(false);
      setCeremony({ open: true, stage: 'printing', data: { ...data, orderNo: res.id, at: new Date(res.createdAt || Date.now()), duplicate: Boolean(res.duplicate) } });
      // Satır satır çıkışa eşlik eden hafif titreşim (destekleyen telefonlarda).
      try {
        navigator.vibrate?.([14, 70, 14, 70, 14, 70, 14, 70, 14]);
      } catch {
        /* titreşim yok */
      }
      timers.current.push(
        window.setTimeout(() => {
          setCeremony((c) => (c.open ? { ...c, stage: 'complete' } : c));
          try {
            navigator.vibrate?.(40);
          } catch {
            /* titreşim yok */
          }
        }, PRINT_MS + 200),
      );
    } catch {
      setCeremony((c) => (c.data ? { ...c, open: true, stage: 'error', error: en ? 'Order could not be sent. Please try again.' : 'Sipariş gönderilemedi. Tekrar dene.' } : CLOSED));
    } finally {
      setBusy(false);
    }
  }

  const closeCeremony = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setCeremony(CLOSED);
    setSheetOpen(false);
  };

  return (
    <>
      {mounted ? (
        <div className={`cs${sheetOpen ? ' is-open' : ''}`} inert={!sheetOpen} role="dialog" aria-modal="true" aria-label={en ? 'Your order' : 'Siparişin'}>
          <button type="button" className="cs__backdrop" aria-label={en ? 'Close' : 'Kapat'} onClick={() => setSheetOpen(false)} />
          <section ref={panelRef} tabIndex={-1} className="cs__panel">
            <header className="cs__head">
              <div>
                <p className="cs__eyebrow">{masaLabel}</p>
                <h2>
                  <ShoppingBag size={20} aria-hidden />
                  {en ? 'Your order' : 'Siparişin'}
                  {count > 0 ? <span className="cs__badge">{count}</span> : null}
                </h2>
              </div>
              <button type="button" className="cs__close" onClick={() => setSheetOpen(false)} aria-label={en ? 'Close' : 'Kapat'}>
                <X size={20} />
              </button>
            </header>

            <div className="cs__body">
              {items.length === 0 ? (
                <div className="cs__empty">
                  <span aria-hidden>
                    <ShoppingBag size={30} />
                  </span>
                  <p>{en ? 'Your cart is empty. Add something you like.' : 'Sepetin boş. Beğendiğin bir şey ekle.'}</p>
                </div>
              ) : (
                <ul className="cs__list">
                  {items.map((item, idx) => (
                    <li key={item.productId} className="cs__row" style={{ ['--i' as string]: idx }}>
                      <div className="cs__thumb">
                        {item.imageUrl ? <img src={imageUrl(item.imageUrl)} alt="" /> : <MenuMediaPlaceholder kind="product" size="sm" label={item.name} />}
                      </div>
                      <div className="cs__meta">
                        <p className="cs__name">{item.name}</p>
                        <p className="cs__price">
                          {formatMoney(item.price * item.qty, item.currency)}
                          {item.calories != null && item.calories > 0 ? (
                            <>
                              {' · '}
                              <SiparisKcal calories={item.calories * item.qty} />
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="cs__qty">
                        <button type="button" onClick={() => setQty(item.productId, item.qty - 1)} aria-label={en ? `Remove one ${item.name}` : `${item.name} bir azalt`}>
                          <Minus size={15} />
                        </button>
                        <span aria-live="polite">{item.qty}</span>
                        <button type="button" onClick={() => setQty(item.productId, item.qty + 1)} aria-label={en ? `Add one ${item.name}` : `${item.name} bir artır`}>
                          <Plus size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {allergyWarning ? (
                <p className="cs__allergy" role="alert">
                  <TriangleAlert size={16} aria-hidden />
                  <span>{allergyWarning}</span>
                </p>
              ) : null}

              {items.length ? (
                <label className="cs__note">
                  <span>{en ? 'Note for the kitchen (optional)' : 'Mutfağa not (opsiyonel)'}</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={en ? 'e.g. no onion' : 'örn. soğansız'} />
                </label>
              ) : null}
            </div>

            <footer className="cs__foot">
              <div className="cs__totals">
                <div>
                  <span>{en ? 'Total' : 'Toplam'}</span>
                  <strong>{formatMoney(totalPrice, currency)}</strong>
                </div>
                {totalCalories != null ? (
                  <div className="cs__kcal">
                    <span>{en ? 'Calories' : 'Kalori'}</span>
                    <b>
                      <SiparisKcal calories={totalCalories} />
                    </b>
                  </div>
                ) : null}
              </div>
              <button type="button" className="cs__confirm" disabled={busy || items.length === 0} onClick={() => void confirm()}>
                <Printer size={19} aria-hidden />
                <span>{busy ? (en ? 'Sending…' : 'Gönderiliyor…') : en ? 'Confirm order' : 'Siparişi onayla'}</span>
              </button>
              <p className="cs__hint">{en ? 'Your order goes straight to the table. No online payment.' : 'Siparişin masana bildirilir. Online ödeme yok.'}</p>
            </footer>
          </section>
        </div>
      ) : null}

      <ReceiptPrinter
        open={ceremony.open}
        stage={ceremony.stage}
        data={ceremony.data}
        lang={lang}
        errorMessage={ceremony.error}
        onRetry={() => void confirm()}
        onClose={closeCeremony}
      />
    </>
  );
}
