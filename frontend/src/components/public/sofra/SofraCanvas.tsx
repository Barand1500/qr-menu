import MobileBookMenu from '../atelier/MobileBookMenu';
import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ArrowRight, Clock, Search, Utensils } from 'lucide-react';
import { imageUrl, formatMoney } from '@/lib/api';
import LanguageFlag from '@/components/LanguageFlag';
import { sofraCopy } from '@/lib/sofra';
import {
  SofraBrand,
  SofraImage,
  SofraText,
  type SofraEditing,
  type SofraRestaurant,
  type SofraGroup,
  type SofraProduct,
} from './SofraElements';
import { AtelierWelcome, AtelierMenu } from '../atelier/AtelierViews';
import './sofra.css';
import './sofra-overlays.css';
export { SofraText, SofraBrand } from './SofraElements';
export type { SofraEditing, SofraRestaurant, SofraGroup, SofraProduct } from './SofraElements';
import type { SofraConfig } from '@/lib/sofra';
export function SofraWelcomeView(props: ComponentProps<typeof SofraWelcomeClassic>) {
  return <AtelierWelcome {...props} />;
}
export function SofraMenuView(props: ComponentProps<typeof SofraMenuClassic>) {
  const root = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  useLayoutEffect(() => {
    const view = root.current?.ownerDocument.defaultView;
    if (!view) return;
    const media = view.matchMedia('(max-width: 1023px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return (
    <div ref={root} style={{ display: 'contents' }}>
      {mobile ? <MobileBookMenu {...props} /> : <AtelierMenu {...props} />}
    </div>
  );
}
export function SofraWelcomeClassic({
  config,
  restaurant,
  lang,
  languages,
  onLangChange,
  onEnter,
  tableLabel,
  extra,
  entering,
  onTextEdit,
  onImageEdit,
  onBrandEdit,
}: {
  config: SofraConfig;
  restaurant: SofraRestaurant;
  lang: string;
  languages: { code: string; name: string }[];
  onLangChange?: (code: string) => void;
  onEnter?: () => void;
  tableLabel?: string | null;
  extra?: ReactNode;
  entering?: boolean;
} & SofraEditing) {
  const copy = sofraCopy(config, lang);
  return (
    <div
      className={`sofra sofra-welcome${entering ? ' is-entering' : ''}`}
      dir={['ar', 'he', 'fa', 'ur'].includes(lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <header className="sofra-masthead">
        <SofraBrand restaurant={restaurant} config={config} onBrandEdit={onBrandEdit} />
        <div className="sofra-header-tools">
          <label className="sofra-language">
            <LanguageFlag code={lang} size={18} />
            <span className="sr-only">Dil / Language</span>
            <select
              value={lang}
              onChange={(e) => onLangChange?.(e.target.value)}
              disabled={!onLangChange}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {tableLabel && (
            <span className="sofra-table">
              <Utensils size={14} />
              {tableLabel}
            </span>
          )}
        </div>
      </header>
      <main className="sofra-welcome-layout">
        <div className="sofra-welcome-copy">
          <span className="sofra-overline">{config.brandName || restaurant.name}</span>
          <SofraText
            as="h1"
            field="welcomeTitle"
            value={copy.welcomeTitle}
            onTextEdit={onTextEdit}
          />
          <SofraText
            as="p"
            className="sofra-welcome-subtitle"
            field="welcomeSubtitle"
            value={copy.welcomeSubtitle}
            onTextEdit={onTextEdit}
          />
          <button
            type="button"
            className="sofra-primary sofra-enter"
            onClick={onEnter}
            disabled={entering}
          >
            <SofraText field="enterLabel" value={copy.enterLabel} onTextEdit={onTextEdit} />
            <ArrowRight size={24} aria-hidden />
          </button>
          <div className="sofra-welcome-foot">
            <span className="sofra-fine-rule" />
            {config.openingHours && (
              <p>
                <Clock size={14} /> {config.openingHours}
              </p>
            )}
            <SofraText as="p" field="footerText" value={copy.footerText} onTextEdit={onTextEdit} />
          </div>
        </div>
        <SofraImage
          src={config.welcomeImage}
          alt={lang === 'en' ? 'A generous breakfast at our table' : 'Soframızdan bir kahvaltı'}
          field="welcomeImage"
          className="sofra-welcome-photo"
          onImageEdit={onImageEdit}
        />
        <span className="sofra-seal" aria-hidden={onTextEdit ? undefined : true}>
          <SofraText field="sealText" value={copy.sealText} onTextEdit={onTextEdit} />
          <Utensils size={22} />
          <small>{config.brandName || restaurant.name}</small>
        </span>
      </main>
      {extra && <footer className="sofra-welcome-extra">{extra}</footer>}
    </div>
  );
}

export function SofraMenuClassic({
  config,
  lang,
  restaurant,
  groups,
  activeGroup,
  onGroupChange,
  products,
  onProductOpen,
  onAdd,
  search,
  onSearchChange,
  loading,
  error,
  onRetry,
  headerTools,
  beforeContent,
  afterContent,
  subgroups,
  onTextEdit,
  onImageEdit,
  onBrandEdit,
}: {
  config: SofraConfig;
  lang: string;
  restaurant: SofraRestaurant;
  groups: SofraGroup[];
  activeGroup?: number | null;
  onGroupChange?: (id: number | null) => void;
  products: SofraProduct[];
  onProductOpen?: (id: number) => void;
  onAdd?: (p: SofraProduct) => void;
  search?: string;
  onSearchChange?: (text: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  headerTools?: ReactNode;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
  subgroups?: { id: number; name: string; products: SofraProduct[] }[];
} & SofraEditing) {
  const copy = sofraCopy(config, lang);
  const en = lang.split('-')[0] === 'en';
  const renderRows = (rows: SofraProduct[]) => (
    <div className="sofra-dishes">
      {rows.map((p) => (
        <article className={`sofra-dish${p.soldOut ? ' is-sold-out' : ''}`} key={p.id}>
          <button type="button" className="sofra-dish-main" onClick={() => onProductOpen?.(p.id)}>
            <span className="sofra-dish-photo">
              {p.imageUrl ? (
                <img
                  src={imageUrl(p.imageUrl)}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
              ) : (
                <Utensils size={24} />
              )}
            </span>
            <span className="sofra-dish-copy">
              <strong>{p.name}</strong>
              {p.description && <span>{p.description}</span>}
              {p.soldOut && <small>{en ? 'Sold out today' : 'Bugün bitti'}</small>}
              {p.calories != null && <small>{p.calories} kcal</small>}
            </span>
            <span className="sofra-dish-price">{formatMoney(p.price, p.currency)}</span>
          </button>
          {onAdd && (
            <button
              type="button"
              className="sofra-add"
              disabled={p.soldOut}
              onClick={() => onAdd(p)}
              aria-label={`${p.name}: ${p.hasOptions ? (en ? 'Choose options' : 'Seçenekleri seç') : en ? 'Add to cart' : 'Sepete ekle'}`}
            >
              +
            </button>
          )}
        </article>
      ))}
    </div>
  );
  return (
    <div
      className="sofra sofra-menu"
      dir={['ar', 'he', 'fa', 'ur'].includes(lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <header className="sofra-masthead">
        <SofraBrand restaurant={restaurant} config={config} onBrandEdit={onBrandEdit} />
        <div className="sofra-header-tools">{headerTools}</div>
      </header>
      <div className="sofra-menu-layout">
        <nav className="sofra-categories" aria-label={en ? 'Categories' : 'Kategoriler'}>
          <button
            type="button"
            className={activeGroup == null ? 'is-active' : ''}
            onClick={() => onGroupChange?.(null)}
          >
            <span className="sofra-category-number">00</span>
            <SofraText
              className="sofra-category-name"
              field="picksLabel"
              value={copy.picksLabel}
              onTextEdit={onTextEdit}
            />
          </button>
          {groups.map((g, i) => (
            <button
              type="button"
              key={g.id}
              className={activeGroup === g.id ? 'is-active' : ''}
              onClick={() => onGroupChange?.(g.id)}
            >
              <span className="sofra-category-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="sofra-category-name">{g.name}</span>
            </button>
          ))}
          <div className="sofra-category-seal" aria-hidden={onTextEdit ? undefined : true}>
            <SofraText field="sealText" value={copy.sealText} onTextEdit={onTextEdit} />
            <small>{config.brandName || restaurant.name}</small>
          </div>
        </nav>
        <main className="sofra-menu-content">
          <div className="sofra-section-heading">
            <div>
              <SofraText as="h1" field="menuTitle" value={copy.menuTitle} onTextEdit={onTextEdit} />
              <SofraText
                as="p"
                className="sofra-overline"
                field="menuEyebrow"
                value={copy.menuEyebrow}
                onTextEdit={onTextEdit}
              />
            </div>
            <label className="sofra-search">
              <Search size={18} />
              <input
                type="search"
                aria-label={en ? 'Search menu' : 'Menüde ara'}
                placeholder={en ? 'Search menu' : 'Menüde ara'}
                value={search || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </label>
          </div>
          {beforeContent}
          <div className={`sofra-spread${activeGroup != null || search?.trim() ? ' is-list' : ''}`}>
            {activeGroup == null && !search?.trim() && (
              <SofraImage
                src={config.menuImage}
                alt={en ? 'From our table' : 'Soframızdan lezzetler'}
                field="menuImage"
                className="sofra-menu-photo"
                onImageEdit={onImageEdit}
              />
            )}
            <div className="sofra-menu-rows">
              {activeGroup != null && (
                <h2 className="sofra-active-group">
                  {groups.find((g) => g.id === activeGroup)?.name}
                </h2>
              )}
              {loading ? (
                <p className="sofra-empty" role="status">
                  {en ? 'Preparing your table…' : 'Sofra hazırlanıyor…'}
                </p>
              ) : error ? (
                <div className="sofra-empty" role="alert">
                  <p>{error}</p>
                  <button onClick={onRetry}>{en ? 'Try again' : 'Tekrar dene'}</button>
                </div>
              ) : (
                <>
                  {renderRows(products)}
                  {subgroups?.map((g) => (
                    <section key={g.id}>
                      <h2 className="sofra-subgroup">{g.name}</h2>
                      {renderRows(g.products)}
                    </section>
                  ))}
                  {!products.length && !subgroups?.some((g) => g.products.length) && (
                    <p className="sofra-empty">
                      {en ? 'No dishes found.' : 'Bu seçimde ürün bulunamadı.'}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          {afterContent}
          <footer className="sofra-menu-footer">
            <SofraText field="footerText" value={copy.footerText} onTextEdit={onTextEdit} />
          </footer>
        </main>
      </div>
    </div>
  );
}
