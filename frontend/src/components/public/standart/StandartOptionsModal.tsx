import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import SadeProductOptions from '@/components/public/sade/SadeProductOptions';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { ProductOptionGroup, SelectionMap } from '@/lib/productOptions';

export type StandartModalProduct = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
  optionGroups?: ProductOptionGroup[];
};

export default function StandartOptionsModal({
  product,
  open,
  onClose,
  loading = false,
}: {
  product: StandartModalProduct | null;
  open: boolean;
  onClose: () => void;
  loading?: boolean;
}) {
  const { addItem, setSheetOpen } = useSiparisCart();
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const optionGroups = product?.optionGroups?.length ? product.optionGroups : [];
  const [unitPrice, setUnitPrice] = useState(product?.price ?? 0);
  const [optionLabel, setOptionLabel] = useState('');

  const onOptionsChange = useCallback(
    (next: { unitPrice: number; selections: SelectionMap; label: string }) => {
      setUnitPrice(next.unitPrice);
      setOptionLabel(next.label);
    },
    []
  );

  useEffect(() => {
    setUnitPrice(product?.price ?? 0);
    setOptionLabel('');
  }, [product?.id, product?.price, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !product) return null;

  function onAdd() {
    const name = optionLabel ? `${product!.name} (${optionLabel})` : product!.name;
    addItem(
      {
        productId: product!.id,
        name,
        price: optionGroups.length ? unitPrice : product!.price,
        currency: product!.currency,
        imageUrl: product!.imageUrl || null,
        calories: product!.calories ?? null,
      },
      { qty: 1, fromEl: addBtnRef.current }
    );
    setSheetOpen(true);
    onClose();
  }

  return (
    <div className="std-opts-modal" role="dialog" aria-modal="true" aria-labelledby="std-opts-title">
      <button type="button" className="std-opts-modal__backdrop" aria-label="Kapat" onClick={onClose} />
      <div className="std-opts-modal__sheet">
        <header className="std-opts-modal__head">
          <div className="std-opts-modal__thumb">
            {product.imageUrl ? (
              <img src={imageUrl(product.imageUrl)} alt="" />
            ) : (
              <MenuMediaPlaceholder kind="product" size="sm" label={product.name} />
            )}
          </div>
          <div className="std-opts-modal__titles">
            <p className="std-opts-modal__hint">Lütfen detaylarını seçiniz</p>
            <h2 id="std-opts-title">{product.name}</h2>
            <p className="std-opts-modal__price">
              {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
            </p>
          </div>
          <button type="button" className="std-opts-modal__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="std-opts-modal__body">
          {loading ? (
            <p className="std-opts-modal__loading">Seçenekler yükleniyor…</p>
          ) : optionGroups.length > 0 ? (
            <SadeProductOptions
              key={product.id}
              groups={optionGroups}
              basePrice={product.price}
              currency={product.currency}
              onChange={onOptionsChange}
            />
          ) : (
            <p className="std-opts-modal__loading">Seçenek bulunamadı</p>
          )}
        </div>

        <footer className="std-opts-modal__foot">
          <button
            ref={addBtnRef}
            type="button"
            className="std-opts-modal__add"
            onClick={onAdd}
            disabled={loading}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Sepete ekle · {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
          </button>
        </footer>
      </div>
    </div>
  );
}
