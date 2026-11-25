import MenuShareButton from '../share/MenuShareButton';
import { publicMenuShareUrl } from '@/lib/menuShare';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Clock, GripVertical, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import { useProductGalleryIndex } from '@/components/public/ProductImageGallery';
import MenuColorModeToggle from '@/components/public/MenuColorModeToggle';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import SiparisCartButton from '@/components/public/siparis/SiparisCartButton';
import SiparisKcal from '@/components/public/siparis/SiparisKcal';
import IngredientCard from '@/components/public/siparis/IngredientCard';
import SiparisProductOptions from '@/components/public/siparis/SiparisProductOptions';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { ingredientEmoji, parseIngredients } from '@/lib/ingredientChips';
import { prefersReducedMotion } from '@/lib/gsapSetup';
import type { MenuColorMode } from '@/lib/menuColorMode';
import type { ProductOptionGroup, SelectionMap } from '@/lib/productOptions';
import Plate, { type PlateHandle } from './Plate';
import RollingPrice from './RollingPrice';
import { analyzeDiet, dominantColor, isFlagged, sizeScale } from './plateData';
import './plate-product.css';

gsap.registerPlugin(Draggable);

type Currency = { code?: string; symbol?: string } | null;
export type PlateProduct = {
  id: number;
  name: string;
  description: string;
  ingredients?: string;
  allergens?: string;
  price: number;
  currency?: Currency;
  imageUrl?: string | null;
  prepTimeMinutes?: number | null;
  calories?: number | null;
  group: { id: number; name: string };
  restaurant: { name: string };
  menuFeatures?: { tableService?: boolean; siparisCart?: boolean; siparisVariants?: boolean };
  optionGroups?: ProductOptionGroup[];
  soldOut?: boolean;
};
export type PlateRelated = { id: number; name: string; price: number; currency?: Currency; imageUrl?: string | null };

const COLD = /tatlı|tatli|dondurma|içecek|icecek|soğuk|soguk|salata|meyve|kokteyl|limonata|smoothie|dessert|drink|salad|ice|cold|beverage|coffee|kahve|çay|cay/i;

/** Ürüne en uygun tabak: sürüklenebilen küçük tabaklar. Masaüstünde ana tabağa bırakılınca sepete eklenir; "+" her yerde çalışır. */
function PairDock({
  related,
  en,
  canAdd,
  plateRef,
  onAdd,
}: {
  related: PlateRelated[];
  en: boolean;
  canAdd: boolean;
  plateRef: React.RefObject<PlateHandle | null>;
  onAdd: (r: PlateRelated) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const addRef = useRef(onAdd);
  addRef.current = onAdd;

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !canAdd || prefersReducedMotion()) return;
    if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) return;
    const els = Array.from(row.querySelectorAll<HTMLElement>('.pl-pair__plate'));
    const drags = els.map((el) => {
      const id = Number(el.dataset.id);
      return Draggable.create(el, {
        type: 'x,y',
        zIndexBoost: true,
        onPress() {
          el.classList.add('is-drag');
        },
        onDrag() {
          const target = plateRef.current?.el;
          const over = target ? this.hitTest(target, '38%') : false;
          el.classList.toggle('is-over', over);
          target?.classList.toggle('is-drop', over);
        },
        onRelease() {
          el.classList.remove('is-drag');
        },
        onDragEnd() {
          const target = plateRef.current?.el;
          target?.classList.remove('is-drop');
          const over = target ? this.hitTest(target, '38%') : false;
          el.classList.remove('is-over');
          const item = related.find((r) => r.id === id);
          if (over && item) {
            plateRef.current?.absorb(el.getBoundingClientRect(), item.imageUrl);
            addRef.current(item);
            gsap.set(el, { x: 0, y: 0, opacity: 0 });
            gsap.to(el, { opacity: 1, duration: 0.5, delay: 0.7 });
          } else {
            gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.6)' });
          }
        },
      })[0];
    });
    return () => drags.forEach((d) => d.kill());
  }, [related, canAdd, plateRef]);

  return (
    <div className="pl-pair" ref={rowRef}>
      {related.slice(0, 6).map((r) => (
        <div className="pl-pair__item" key={r.id}>
          <div className="pl-pair__plate" data-id={r.id} aria-hidden="true">
            {r.imageUrl ? <img src={imageUrl(r.imageUrl)} alt="" draggable={false} loading="lazy" /> : <span className="pl-pair__ph" />}
            {canAdd ? (
              <i className="pl-pair__grip">
                <GripVertical size={12} />
              </i>
            ) : null}
          </div>
          <Link to={menuProductPath(r.id)} className="pl-pair__name">
            {r.name}
          </Link>
          <div className="pl-pair__row">
            <strong>{formatMoney(r.price, r.currency)}</strong>
            {canAdd ? (
              <button type="button" className="pl-pair__add" onClick={() => onAdd(r)} aria-label={`${r.name} ${en ? 'add' : 'ekle'}`}>
                <Plus size={15} strokeWidth={2.6} />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Ürün detayı — "tabak görünümü": solda yapışkan sahne ve fareyle eğilen/çevrilen tabak, sağda kaydırılan editoryal bilgiler.
 * Yöneticinin Ayarlar → Ürün sayfası anahtarı açıkken kullanılır; kapalıyken klasik sayfa gösterilir.
 */
export default function PlateProductPage({
  product,
  related,
  galleryImages,
  colorMode,
  toggleColorMode,
  lang,
  slug,
  onBack,
  hideColorToggle = false,
}: {
  product: PlateProduct;
  related: PlateRelated[];
  galleryImages: string[];
  colorMode: MenuColorMode;
  toggleColorMode: () => void;
  lang: string;
  slug: string | null | undefined;
  onBack: () => void;
  hideColorToggle?: boolean;
}) {
  const { addItem, enabled: cartCtxOn } = useSiparisCart();
  const { index, setIndex } = useProductGalleryIndex(galleryImages.length);
  const plateRef = useRef<PlateHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addedTimer = useRef<number | undefined>(undefined);
  const [added, setAdded] = useState(false);
  const [solid, setSolid] = useState(false);
  const [hotName, setHotName] = useState<string | null>(null);
  const [glow, setGlow] = useState<string | null>(null);
  const en = (lang || 'tr').split('-')[0] === 'en';
  const tableServiceOn = product.menuFeatures?.tableService !== false;
  const variantsOn = product.menuFeatures?.siparisVariants !== false;
  const cartEnabled = product.menuFeatures?.siparisCart !== false;
  const showCart = cartEnabled && cartCtxOn;
  const soldOut = Boolean(product.soldOut);
  const optionGroups = variantsOn ? product.optionGroups || [] : [];
  const hasOptions = optionGroups.length > 0;

  const [unitPrice, setUnitPrice] = useState(product.price);
  const [optionLabel, setOptionLabel] = useState('');
  const prevParts = useRef<string[]>([]);
  const ready = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => (ready.current = true), 700);
    return () => window.clearTimeout(t);
  }, []);

  const onOptionsChange = useCallback((next: { unitPrice: number; selections: SelectionMap; label: string }) => {
    setUnitPrice(next.unitPrice);
    setOptionLabel(next.label);
    const parts = next.label ? next.label.split(/\s*[,+·]\s*/).filter(Boolean) : [];
    if (ready.current) {
      const added = parts.filter((p) => !prevParts.current.includes(p));
      if (added.length) plateRef.current?.toss(added.map((p) => ingredientEmoji(p) || '✨'));
      plateRef.current?.grow(sizeScale(next.label));
    }
    prevParts.current = parts;
  }, []);

  useEffect(() => {
    setUnitPrice(product.price);
    setOptionLabel('');
    setAdded(false);
  }, [product.id, product.price]);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // Üst çubuk: kaydırınca dolgun
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > (window.innerWidth >= 1024 ? 40 : window.innerHeight * 0.5));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fotoğrafın baskın rengi sahne ışığı olur
  useEffect(() => {
    let live = true;
    const src = galleryImages[index];
    if (!src) return;
    void dominantColor(src.startsWith('blob:') ? src : imageUrl(src)).then((c) => {
      if (live) setGlow(c);
    });
    return () => {
      live = false;
    };
  }, [galleryImages, index]);

  // Bölümler görününce yükselir
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.pl-reveal'));
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [product.id, related.length]);

  // Sepete ekle düğmesi imlece hafifçe yaklaşır (manyetik)
  useEffect(() => {
    const btn = addBtnRef.current;
    if (!btn || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    const qx = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
    const qy = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      qx((e.clientX - (r.left + r.width / 2)) * 0.22);
      qy((e.clientY - (r.top + r.height / 2)) * 0.3);
    };
    const leave = () => {
      qx(0);
      qy(0);
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerleave', leave);
    return () => {
      btn.removeEventListener('pointermove', move);
      btn.removeEventListener('pointerleave', leave);
    };
  }, [showCart, soldOut]);

  // Malzeme halkası: içindekiler etiketleri; yoksa ürün bilgileri
  const parsed = useMemo(() => parseIngredients(product.ingredients || '', true), [product.ingredients]);
  const orbit = useMemo(() => {
    if (parsed) return [...parsed.main, ...parsed.extra].slice(0, 12);
    const out = [product.group.name, product.name];
    if (product.calories) out.push(`${product.calories} kcal`);
    if (product.prepTimeMinutes) out.push(`${product.prepTimeMinutes} dk`);
    return out;
  }, [parsed, product.group.name, product.name, product.calories, product.prepTimeMinutes]);
  const hot = hotName ? orbit.findIndex((n) => n.toLocaleLowerCase('tr') === hotName.toLocaleLowerCase('tr')) : -1;

  const diet = useMemo(() => analyzeDiet([product.ingredients, product.allergens], lang), [product.ingredients, product.allergens, lang]);
  const warn = useMemo(() => new Set(orbit.map((n, i) => (diet.status === 'warn' && isFlagged(n, diet.words) ? i : -1)).filter((i) => i >= 0)), [orbit, diet]);
  const steam = !COLD.test(`${product.group.name} ${product.name}`);

  const price = hasOptions ? unitPrice : product.price;
  const fmt = useCallback((n: number) => formatMoney(n, product.currency), [product.currency]);

  function add() {
    if (soldOut) return;
    const name = optionLabel ? `${product.name} (${optionLabel})` : product.name;
    plateRef.current?.pulse();
    addItem(
      {
        productId: product.id,
        name,
        price,
        currency: product.currency,
        imageUrl: product.imageUrl ?? galleryImages[0] ?? null,
        calories: product.calories ?? null,
      },
      { fromEl: plateRef.current?.el || addBtnRef.current },
    );
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1400);
  }
  function addRelated(r: PlateRelated) {
    addItem(
      { productId: r.id, name: r.name, price: r.price, currency: r.currency, imageUrl: r.imageUrl ?? null, calories: null },
      { fromEl: null },
    );
  }

  const words = product.name.split(/\s+/).filter(Boolean);
  const hasStats = (product.calories ?? 0) > 0 || (product.prepTimeMinutes ?? 0) > 0;
  let sec = 0;
  const num = () => String(++sec).padStart(2, '0');

  return (
    <div
      ref={rootRef}
      className={`pd pl${showCart ? ' pd--bar pl--bar' : ''}`}
      style={glow ? ({ ['--pl-glow' as string]: glow } as React.CSSProperties) : undefined}
    >
      <header className={`pd-top${solid ? ' is-solid' : ''}`}>
        <button type="button" className="pd-glass pd-top__back" onClick={onBack} aria-label="Geri">
          <ArrowLeft size={20} />
        </button>
        <div className="pd-glass pd-top__actions">
          {hideColorToggle && (
            <MenuShareButton
              url={publicMenuShareUrl(menuProductPath(product.id))}
              title={`${product.restaurant.name} · ${product.name}`}
              lang={lang}
              label={en ? 'Share product' : 'Ürünü paylaş'}
            />
          )}
          {showCart ? <SiparisCartButton alwaysShow /> : null}
          {!hideColorToggle && <MenuColorModeToggle colorMode={colorMode} onToggle={toggleColorMode} />}
          <TableServiceButtons lang={lang} slug={slug} enabled={tableServiceOn} />
        </div>
      </header>

      <div className="pl-shell">
        <section className="pl-stage" aria-label={product.name}>
          <div className="pl-stage__bg" aria-hidden="true">
            <i className="pl-aurora pl-aurora--a" />
            <i className="pl-aurora pl-aurora--b" />
            <i className="pl-grain" />
          </div>

          <Plate
            ref={plateRef}
            images={galleryImages}
            index={index}
            alt={product.name}
            orbit={orbit}
            hot={hot >= 0 ? hot : null}
            warn={warn}
            steam={steam}
            diet={diet.status}
          />

          <div className="pl-stage__foot">
            {galleryImages.length > 1 ? (
              <div className="pl-thumbs" role="tablist" aria-label={en ? 'Product photos' : 'Ürün görselleri'}>
                {galleryImages.map((src, i) => (
                  <button key={src + i} type="button" role="tab" aria-selected={i === index} aria-label={`${i + 1}`} className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)}>
                    <img src={imageUrl(src)} alt="" loading="lazy" draggable={false} />
                  </button>
                ))}
              </div>
            ) : null}
            <p className="pl-hint">
              <span className="pl-hint--fine">{en ? 'Grab the plate and turn it' : 'Tabağı tut ve çevir'}</span>
              <span className="pl-hint--touch">{en ? 'Swipe the plate to turn it' : 'Tabağı kaydırarak çevir'}</span>
            </p>
          </div>
        </section>

        <div className="pl-col">
          <div className="pl-col__inner">
            <p className="pl-kicker pl-reveal">
              <span>{product.restaurant.name}</span>
              <i aria-hidden="true" />
              <span>{product.group.name}</span>
            </p>
            <h1 className="pl-title" aria-label={product.name}>
              {words.map((w, i) => (
                <span className="pl-title__w" key={i} aria-hidden="true">
                  <span style={{ ['--i' as string]: i } as React.CSSProperties}>{w}</span>
                </span>
              ))}
            </h1>
            {product.description ? <p className="pl-desc pl-reveal">{product.description}</p> : null}

            <div className="pl-stats pl-reveal">
              {(product.calories ?? 0) > 0 ? (
                <span className="pd-pill">
                  <SiparisKcal calories={product.calories as number} />
                </span>
              ) : null}
              {(product.prepTimeMinutes ?? 0) > 0 ? (
                <span className="pd-pill">
                  <Clock size={15} />
                  {product.prepTimeMinutes} dk
                </span>
              ) : null}
              {!showCart ? <strong className="pl-stats__price">{formatMoney(price, product.currency)}</strong> : null}
              {!hasStats && showCart ? null : null}
            </div>

            {diet.status !== 'none' ? (
              <div className={`pl-diet-chip pl-reveal pl-diet-chip--${diet.status}`} role="status">
                {diet.status === 'warn' ? <ShieldAlert size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
                <span>
                  {diet.status === 'warn' ? (
                    <>
                      <b>{en ? 'Heads up' : 'Dikkat'}</b> {en ? 'Matches your preferences:' : 'Tercihlerinle çakışıyor:'} {diet.conflicts.join(', ')}
                    </>
                  ) : (
                    <>
                      <b>{en ? 'No conflict found' : 'Çakışma bulunamadı'}</b> {en ? 'with your preferences, going by the listed ingredients.' : 'tercihlerinle; yazılı içerik bilgisine göre.'}
                    </>
                  )}
                </span>
              </div>
            ) : null}

            {hasOptions ? (
              <section className="pl-sec pl-reveal">
                <h2>
                  <i>{num()}</i>
                  {en ? 'Make it yours' : 'Seçimini yap'}
                </h2>
                <SiparisProductOptions key={product.id} groups={optionGroups} basePrice={product.price} currency={product.currency} onChange={onOptionsChange} />
              </section>
            ) : null}

            {product.ingredients || product.allergens ? (
              <section className="pl-sec pl-reveal">
                <h2>
                  <i>{num()}</i>
                  {en ? 'What goes in' : 'İçinde neler var'}
                </h2>
                <div className="pd-facts">
                  {product.ingredients ? <IngredientCard text={product.ingredients} kind="ingredients" en={en} onHoverItem={setHotName} /> : null}
                  {product.allergens ? <IngredientCard text={product.allergens} kind="allergens" en={en} /> : null}
                </div>
              </section>
            ) : null}

            {related.length > 0 ? (
              <section className="pl-sec pl-reveal">
                <h2>
                  <i>{num()}</i>
                  {en ? 'Goes well with' : 'Yanında ne gider'}
                </h2>
                {showCart && !soldOut ? <p className="pl-sec__hint">{en ? 'Drag one onto the plate to add it.' : 'Birini tabağa sürükle, sepete eklensin.'}</p> : null}
                <PairDock related={related} en={en} canAdd={showCart} plateRef={plateRef} onAdd={addRelated} />
              </section>
            ) : null}
          </div>

          {showCart ? (
            <div className="pd-bar pl-bar">
              {soldOut ? (
                <p className="pd-bar__sold">{en ? 'Sold out today' : 'Bugün bitti'}</p>
              ) : (
                <>
                  <div className="pd-bar__price">
                    <small>{hasOptions ? (en ? 'By selection' : 'Seçime göre') : en ? 'Price' : 'Fiyat'}</small>
                    <strong>
                      <RollingPrice value={price} format={fmt} />
                    </strong>
                  </div>
                  <button ref={addBtnRef} type="button" className={`pd-bar__add${added ? ' is-added' : ''}`} onClick={add}>
                    {added ? <Check size={20} strokeWidth={2.6} /> : <Plus size={20} strokeWidth={2.4} />}
                    {added ? (en ? 'Added' : 'Eklendi') : en ? 'Add to cart' : 'Sepete ekle'}
                  </button>
                </>
              )}
            </div>
          ) : soldOut ? (
            <p className="pd-bar__sold pd-bar__sold--inline">{en ? 'Sold out today' : 'Bugün bitti'}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
