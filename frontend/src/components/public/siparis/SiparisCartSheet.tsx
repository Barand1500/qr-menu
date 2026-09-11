import { Minus, Plus, ShoppingBag, X, HandHelping, Check, AlertCircle, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney, imageUrl, api, isCodeRequiredError } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import SiparisKcal from '@/components/public/siparis/SiparisKcal';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { resolveTableContext, formatTableServiceLabel } from '@/lib/tableContext';
import { notifyTableRequestCreated } from '@/lib/tableRequestNotify';
import { notifyWaiterCalled } from '@/lib/menuGames';
import { allergenLabel, loadDietaryPrefs } from '@/lib/dietAllergens';
import { useTableSessionCode } from '@/components/public/TableSessionCodeGate';

export default function SiparisCartSheet({ lang }: { lang: string }) {
  const { slug: hookSlug } = useMenuSlug();
  const {
    enabled,
    items,
    note,
    count,
    totalPrice,
    totalCalories,
    sheetOpen,
    setSheetOpen,
    setQty,
    setNote,
  } = useSiparisCart();
  const { ensureUnlocked, markNeedsUnlock } = useTableSessionCode();
  const [tableCtx] = useState(() => resolveTableContext());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const allergyNames = useMemo(() => {
    const prefs = loadDietaryPrefs();
    return prefs.allergens.map((id) => allergenLabel(id, lang)).filter(Boolean);
  }, [lang, sheetOpen, items.length]);

  if (!enabled || !sheetOpen) return null;

  const en = (lang || 'tr').split('-')[0] === 'en';
  const currency = items[0]?.currency;
  const masaLabel = formatTableServiceLabel(tableCtx.masa, tableCtx.grup);

  const allergyWarning =
    allergyNames.length > 0
      ? en
        ? `Warning: This menu may include items that trigger your selected allergies (${allergyNames.join(', ')}). Check each product carefully.`
        : `Uyarı: Seçtiğin alerjenlere dikkat (${allergyNames.join(', ')}). Bu menüde bunları tetikleyebilecek ürünler bulunuyor — ürünleri kontrol et.`
      : null;

  async function callWaiter() {
    if (busy || done || !hookSlug) return;
    setBusy(true);
    setError(false);
    try {
      const unlocked = await ensureUnlocked();
      if (!unlocked) return;

      const body = {
        type: 'waiter' as const,
        tableNumber: tableCtx.masa,
        groupSlug: tableCtx.grup || undefined,
        note: note.trim() || undefined,
        order:
          items.length > 0
            ? {
                items: items.map((i) => ({
                  name: i.name,
                  qty: i.qty,
                  price: i.price,
                  calories: i.calories ?? null,
                })),
                totalPrice,
                totalCalories,
                currency: currency ?? null,
              }
            : undefined,
      };

      async function post() {
        return api<{
          ok: boolean;
          id: number;
          type: string;
          tableNumber: string;
          groupSlug?: string | null;
          note?: string | null;
          orderJson?: string | null;
          createdAt: string;
        }>(`/api/menu/${hookSlug}/table-request`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      let res;
      try {
        res = await post();
      } catch (err) {
        if (!isCodeRequiredError(err)) throw err;
        markNeedsUnlock();
        const again = await ensureUnlocked();
        if (!again) return;
        res = await post();
      }
      notifyTableRequestCreated({
        id: res.id,
        type: res.type,
        tableNumber: res.tableNumber,
        groupSlug: res.groupSlug,
        note: res.note,
        orderJson: res.orderJson,
        createdAt: res.createdAt,
      });
      notifyWaiterCalled();
      setDone(true);
      window.setTimeout(() => setDone(false), 3500);
    } catch {
      setError(true);
      window.setTimeout(() => setError(false), 2800);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="siparis-cart-sheet" role="dialog" aria-modal="true" aria-label={en ? 'Cart' : 'Sepet'}>
      <button
        type="button"
        className="siparis-cart-sheet__backdrop"
        aria-label={en ? 'Close' : 'Kapat'}
        onClick={() => setSheetOpen(false)}
      />
      <div className="siparis-cart-sheet__panel">
        <header className="siparis-cart-sheet__head">
          <div>
            <p className="siparis-cart-sheet__eyebrow">{masaLabel}</p>
            <h2>
              <ShoppingBag className="w-5 h-5" aria-hidden />
              {en ? 'Your order' : 'Siparişin'}
              {count > 0 ? <span className="siparis-cart-sheet__badge">{count}</span> : null}
            </h2>
          </div>
          <button
            type="button"
            className="siparis-cart-sheet__close"
            onClick={() => setSheetOpen(false)}
            aria-label={en ? 'Close' : 'Kapat'}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {items.length === 0 ? (
          <p className="siparis-cart-sheet__empty">
            {en ? 'Cart is empty — add something you like.' : 'Sepet boş — beğendiğini ekle.'}
          </p>
        ) : (
          <ul className="siparis-cart-sheet__list">
            {items.map((item) => (
              <li key={item.productId} className="siparis-cart-sheet__row">
                <div className="siparis-cart-sheet__thumb">
                  {item.imageUrl ? (
                    <img src={imageUrl(item.imageUrl)} alt="" />
                  ) : (
                    <MenuMediaPlaceholder kind="product" size="sm" label={item.name} />
                  )}
                </div>
                <div className="siparis-cart-sheet__meta">
                  <p className="siparis-cart-sheet__name">{item.name}</p>
                  <p className="siparis-cart-sheet__line-price">
                    {formatMoney(item.price * item.qty, item.currency)}
                    {item.calories != null && item.calories > 0 ? (
                      <>
                        {' · '}
                        <SiparisKcal calories={item.calories * item.qty} />
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="siparis-cart-sheet__qty">
                  <button
                    type="button"
                    onClick={() => setQty(item.productId, item.qty - 1)}
                    aria-label="-"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span>{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(item.productId, item.qty + 1)}
                    aria-label="+"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {allergyWarning ? (
          <p className="siparis-cart-sheet__allergy" role="alert">
            <TriangleAlert className="w-4 h-4 siparis-cart-sheet__allergy-icon" aria-hidden />
            <span>{allergyWarning}</span>
          </p>
        ) : null}

        <label className="siparis-cart-sheet__note">
          <span>{en ? 'Note (optional)' : 'Not (opsiyonel)'}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={en ? 'e.g. no onion' : 'örn. soğansız'}
          />
        </label>

        <div className="siparis-cart-sheet__totals">
          <div>
            <span>{en ? 'Total' : 'Toplam'}</span>
            <strong>{formatMoney(totalPrice, currency)}</strong>
          </div>
          <div>
            <span>{en ? 'Calories' : 'Kalori'}</span>
            <strong>
              {totalCalories != null ? <SiparisKcal calories={totalCalories} /> : '—'}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className={`siparis-cart-sheet__waiter${done ? ' is-done' : ''}${error ? ' is-error' : ''}`}
          disabled={busy}
          onClick={() => void callWaiter()}
        >
          {error ? (
            <AlertCircle className="w-5 h-5" />
          ) : done ? (
            <Check className="w-5 h-5" />
          ) : (
            <HandHelping className="w-5 h-5" />
          )}
          {error
            ? en
              ? 'Failed'
              : 'Olmadı'
            : done
              ? en
                ? 'Sent'
                : 'İletildi'
              : busy
                ? en
                  ? 'Sending…'
                  : 'Gönderiliyor…'
                : en
                  ? 'Call waiter'
                  : 'Garson çağır'}
        </button>
        <p className="siparis-cart-sheet__hint">
          {en
            ? 'Sends products + note to the table — no online payment.'
            : 'Ürünler ve not masaya bildirim olarak gider — online ödeme yok.'}
        </p>
      </div>
    </div>
  );
}
