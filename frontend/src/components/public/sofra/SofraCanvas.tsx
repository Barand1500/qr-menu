import { useRef, type ElementType, type ReactNode } from 'react';
import { ArrowRight, Clock, Search, Utensils } from 'lucide-react';
import { imageUrl, formatMoney } from '@/lib/api';
import LanguageFlag from '@/components/LanguageFlag';
import { sofraCopy, type SofraConfig, type SofraTextField } from '@/lib/sofra';
import './sofra.css';
import './sofra-overlays.css';

export interface SofraEditing {
  onTextEdit?: (field: SofraTextField, value: string) => void;
  onImageEdit?: (field: 'welcomeImage' | 'menuImage') => void;
  onBrandEdit?: (value: string) => void;
}
export interface SofraRestaurant {
  name: string;
  logoUrl?: string | null;
}
export interface SofraGroup {
  id: number;
  name: string;
  imageUrl?: string | null;
}
export interface SofraProduct {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  currency?: { code?: string | null; symbol?: string | null } | null;
  soldOut?: boolean;
  hasOptions?: boolean;
  calories?: number | null;
}
function SofraInlineText({
  as: Tag = 'span',
  field,
  value,
  onChange,
  className,
}: {
  as?: ElementType;
  field: string;
  value: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const focused = useRef(false);
  const shown = useRef(value);
  // Keep the editable DOM stable while typing so React never moves the caret.
  if (!focused.current) shown.current = value;
  const read = (node: HTMLElement) =>
    (node.innerText || '').slice(
      0,
      field === 'enterLabel' ? 60 : field === 'brandName' ? 100 : 400
    );
  return (
    <Tag
      className={className}
      contentEditable={onChange ? 'plaintext-only' : undefined}
      suppressContentEditableWarning={Boolean(onChange)}
      role={onChange ? 'textbox' : undefined}
      tabIndex={onChange ? 0 : undefined}
      aria-label={onChange ? `${field} metnini düzenle` : undefined}
      data-sofra-editable={onChange ? field : undefined}
      onFocus={() => {
        focused.current = true;
      }}
      onInput={
        onChange ? (e: React.FormEvent<HTMLElement>) => onChange(read(e.currentTarget)) : undefined
      }
      onBlur={
        onChange
          ? (e: React.FocusEvent<HTMLElement>) => {
              focused.current = false;
              onChange(read(e.currentTarget));
            }
          : undefined
      }
    >
      {shown.current}
    </Tag>
  );
}
export function SofraText({
  as,
  field,
  value,
  onTextEdit,
  className,
}: {
  as?: ElementType;
  field: SofraTextField;
  value: string;
  className?: string;
} & Pick<SofraEditing, 'onTextEdit'>) {
  return (
    <SofraInlineText
      as={as}
      field={field}
      value={value}
      className={className}
      onChange={onTextEdit ? (value) => onTextEdit(field, value) : undefined}
    />
  );
}
export function SofraBrand({
  restaurant,
  config,
  onBrandEdit,
}: {
  restaurant: SofraRestaurant;
  config: SofraConfig;
  onBrandEdit?: (value: string) => void;
}) {
  return (
    <span className="sofra-brand">
      {restaurant.logoUrl && <img src={imageUrl(restaurant.logoUrl)} alt="" />}
      <SofraInlineText
        field="brandName"
        value={config.brandName || restaurant.name}
        onChange={onBrandEdit}
      />
    </span>
  );
}
function SofraImage({
  src,
  alt,
  field,
  onImageEdit,
  className,
}: {
  src: string;
  alt: string;
  field: 'welcomeImage' | 'menuImage';
  className: string;
} & Pick<SofraEditing, 'onImageEdit'>) {
  const photo = (
    <img
      src={src.startsWith('blob:') ? src : imageUrl(src)}
      alt={alt}
      fetchPriority="high"
      onLoad={(e) => {
        e.currentTarget.style.visibility = '';
      }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
  return onImageEdit ? (
    <button
      type="button"
      className={`${className} sofra-photo-edit`}
      aria-label="Fotoğrafı değiştir"
      onClick={() => onImageEdit(field)}
    >
      {photo}
      <span>Fotoğrafı değiştir</span>
    </button>
  ) : (
    <div className={className}>{photo}</div>
  );
}
export function SofraWelcomeView({
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

export function SofraMenuView({
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
