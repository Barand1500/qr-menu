import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Clock, MoreHorizontal, Package, Sparkles } from 'lucide-react';
import ProductImageCell from '@/components/admin/ProductImageCell';
import { formatMoney } from '@/lib/api';
import type { Product } from './types';
import AnimatedPrice, { type PriceTransition } from './AnimatedPrice';
import VisibilityToggle from '@/components/admin/VisibilityToggle';

export default function ProductRow({
  product: p,
  busy,
  imageBusy,
  onEdit,
  onQuickEdit,
  onToggle,
  onStock,
  onActions,
  onUpload,
  onImageOrder,
  onImageRemove,
  onImageReplace,
  priceTransition,
}: {
  product: Product;
  busy: boolean;
  imageBusy: boolean;
  onEdit: (p: Product) => void;
  onQuickEdit: (
    p: Product,
    field: 'name' | 'price',
    value: string,
  ) => Promise<boolean>;
  onToggle: (p: Product) => void;
  onStock: (p: Product) => void;
  onActions: (p: Product, e: MouseEvent<HTMLElement>) => void;
  onUpload: (files: File[]) => Promise<void>;
  onImageOrder: (urls: string[]) => Promise<boolean>;
  onImageRemove: (url: string) => Promise<boolean>;
  onImageReplace: (url: string, file: File) => Promise<boolean>;
  priceTransition?: PriceTransition;
}) {
  const [field, setField] = useState<'name' | 'price' | null>(null),
    [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const hint = useId();
  useEffect(() => {
    if (field) {
      input.current?.focus();
      input.current?.select();
    }
  }, [field]);
  function start(next: 'name' | 'price') {
    setField(next);
    setValue(next === 'price' ? String(p.price).replace('.', ',') : p.name);
  }
  async function commit() {
    if (!field || lock.current || busy) return;
    lock.current = true;
    try {
      if (await onQuickEdit(p, field, value)) setField(null);
    } finally {
      lock.current = false;
    }
  }
  const edit = (
    <form
      className="ap-inline"
      onSubmit={(e) => {
        e.preventDefault();
        void commit();
      }}
    >
      <input
        ref={input}
        value={value}
        aria-label={`${p.name} ${field === 'price' ? 'fiyatı' : 'yeni adı'}`}
        aria-describedby={hint}
        inputMode={field === 'price' ? 'decimal' : 'text'}
        enterKeyHint="done"
        maxLength={field === 'name' ? 200 : 16}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) {
            e.preventDefault();
            e.stopPropagation();
            setField(null);
          }
        }}
      />
      <small id={hint}>{busy ? 'Kaydediliyor…' : 'Enter ile kaydet'}</small>
    </form>
  );
  const optionOut = p.optionGroups?.some((g) =>
    g.options.some((o) => o.stockQty === 0),
  );
  return (
    <article
      className={`ap-product${!p.isActive ? ' is-hidden' : ''}${field === 'name' ? ' is-renaming' : ''}`}
      data-product-row={p.id}
      onContextMenu={(e) => {
        if (!(e.target as HTMLElement).closest('input')) onActions(p, e);
      }}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('button,input,form')) onEdit(p);
      }}
    >
      <div className="ap-product__photo">
        <ProductImageCell
          name={p.name}
          cover={p.imageUrl}
          images={p.images}
          busy={imageBusy}
          disabled={busy}
          onUpload={onUpload}
          onOrder={onImageOrder}
          onRemove={onImageRemove}
          onReplace={onImageReplace}
        />
      </div>
      <div className="ap-product__identity">
        <p className="ap-product__group">{p.groupName}</p>
        {field === 'name' ? (
          edit
        ) : (
          <button
            className="ap-product__name"
            disabled={busy}
            onClick={() => start('name')}
          >
            {p.name}
          </button>
        )}
        <div className="ap-product__notes">
          {!p.isValid && <span className="is-warning">Kontrol gerekli</span>}
          {p.isRecommended && (
            <span>
              <Sparkles size={12} />
              Önerilen
            </span>
          )}
          {Boolean(p.optionGroups?.length) && <span>Seçenekli</span>}
        </div>
      </div>
      <div className="ap-product__price">
        {field === 'price' ? (
          edit
        ) : (
          <button
            disabled={busy}
            aria-label={`${p.name} fiyatını düzenle`}
            onClick={() => start('price')}
          >
            <strong>
              <AnimatedPrice
                value={p.price}
                currency={p.currency}
                transition={priceTransition}
              />
            </strong>
            {p.optionGroups?.length ? <small>başlangıç fiyatı</small> : null}
          </button>
        )}
        {p.previousPrice != null && (
          <small className="ap-previous">
            Önceki {formatMoney(p.previousPrice, p.currency)}
          </small>
        )}
      </div>
      <div className="ap-product__availability">
        <button
          className={`ap-stock${p.stockQty === 0 || optionOut ? ' is-out' : ''}`}
          disabled={busy}
          aria-label={`${p.name} stok yönetimi`}
          onClick={() => onStock(p)}
        >
          <Package size={15} />
          <span>
            {p.stockQty === 0
              ? 'Tükendi'
              : p.stockQty == null
                ? 'Sınırsız'
                : `${p.stockQty} adet`}
            {optionOut && <small>Varyant tükendi</small>}
          </span>
          {p.stockResetHour != null && <Clock size={12} />}
        </button>
        <VisibilityToggle
          checked={p.isActive}
          label={`${p.name} menüde görünür`}
          disabled={busy}
          onToggle={() => onToggle(p)}
        />
      </div>
      <button
        className="ag-icon ap-product__more"
        disabled={busy}
        aria-label={`${p.name} işlemleri`}
        onClick={(e) => onActions(p, e)}
      >
        <MoreHorizontal size={20} />
      </button>
    </article>
  );
}
