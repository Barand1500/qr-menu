import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, Clock, Search, Utensils } from 'lucide-react';
import LanguageFlag from '@/components/LanguageFlag';
import { formatMoney, imageUrl } from '@/lib/api';
import { sofraCopy } from '@/lib/sofra';
import { SofraBrand, SofraText, type SofraProduct } from '../sofra/SofraElements';
import type { SofraWelcomeClassic, SofraMenuClassic } from '../sofra/SofraCanvas';
import TablePresentation from './TablePresentation';
import TableReceipt from './TableReceipt';
import './table.css';

export function TableWelcome(props: ComponentProps<typeof SofraWelcomeClassic>) {
  const {
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
  } = props;
  const copy = sofraCopy(config, lang),
    en = lang.split('-')[0] === 'en';
  return (
    <div
      className={`sofra table-world table-welcome${entering ? ' is-entering' : ''}`}
      dir={['ar', 'he', 'fa', 'ur'].includes(lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <div className="table-welcome__world">
        <TablePresentation
          variant="welcome"
          lang={lang}
          item={{ id: 0, imageUrl: config.welcomeImage }}
          onActivate={() => {
            if (onImageEdit) onImageEdit('welcomeImage');
            else if (!entering) onEnter?.();
          }}
        />
      </div>
      <header className="table-masthead">
        <SofraBrand restaurant={restaurant} config={config} onBrandEdit={onBrandEdit} />
        <div className="table-header-tools">
          <label className="sofra-language">
            <LanguageFlag code={lang} size={20} />
            <span className="sr-only">Dil / Language</span>
            <select
              value={lang}
              disabled={!onLangChange}
              onChange={(e) => onLangChange?.(e.target.value)}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {tableLabel && (
            <span className="table-seat">
              <Utensils size={14} />
              {tableLabel}
            </span>
          )}
        </div>
      </header>
      <main className="table-welcome__copy">
        <span className="table-eyebrow">
          {en ? 'A PLACE AT OUR TABLE' : 'SOFRAMIZDA YERİNİZ HAZIR'}
        </span>
        <SofraText as="h1" field="welcomeTitle" value={copy.welcomeTitle} onTextEdit={onTextEdit} />
        <SofraText
          as="p"
          className="table-welcome__subtitle"
          field="welcomeSubtitle"
          value={copy.welcomeSubtitle}
          onTextEdit={onTextEdit}
        />
        <button
          type="button"
          className="table-enter sofra-enter"
          onClick={onEnter}
          disabled={entering}
        >
          <span>
            <SofraText field="enterLabel" value={copy.enterLabel} onTextEdit={onTextEdit} />
          </span>
          <ArrowRight size={23} />
        </button>
        <div className="table-welcome__foot">
          <div className="table-welcome__seal">
            <SofraText field="sealText" value={copy.sealText} onTextEdit={onTextEdit} />
            <span>{en ? 'MADE TO BE SHARED' : 'PAYLAŞMAK İÇİN HAZIRLANDI'}</span>
          </div>

          {config.openingHours && (
            <p>
              <Clock size={14} />
              {config.openingHours}
            </p>
          )}
          <SofraText as="p" field="footerText" value={copy.footerText} onTextEdit={onTextEdit} />
        </div>
      </main>
      {onImageEdit && (
        <button
          type="button"
          className="table-photo-edit"
          onClick={() => onImageEdit('welcomeImage')}
        >
          {en ? 'Change table image' : 'Sofradaki görseli değiştir'}
        </button>
      )}
      {extra && <footer className="table-welcome__extra">{extra}</footer>}
    </div>
  );
}

export function TableMenu(props: ComponentProps<typeof SofraMenuClassic>) {
  const {
    config,
    restaurant,
    lang,
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
  } = props;
  const copy = sofraCopy(config, lang),
    en = lang.split('-')[0] === 'en';
  const [selected, setSelected] = useState(0);
  const rows = useMemo(
    () => [...products, ...(subgroups || []).flatMap((g) => g.products)],
    [products, subgroups]
  );
  useEffect(() => setSelected(0), [activeGroup, search]);
  const current = Math.max(0, Math.min(selected, Math.max(0, rows.length - 1)));
  const featured = rows[current];
  function renderList(list: SofraProduct[], title?: string) {
    return (
      <section key={title || 'main'}>
        {title && <h2 className="table-directory__group">{title}</h2>}
        <div className="sofra-dishes">
          {list.map((p) => (
            <article
              key={p.id}
              className={`sofra-dish table-directory__dish${featured?.id === p.id ? ' is-featured' : ''}${p.soldOut ? ' is-sold-out' : ''}`}
            >
              <button
                type="button"
                className="table-directory__preview"
                aria-pressed={featured?.id === p.id}
                aria-label={`${p.name}: ${en ? 'Preview' : 'Görseli incele'}`}
                onClick={() => setSelected(rows.findIndex((row) => row.id === p.id))}
              >
                {p.imageUrl ? (
                  <img
                    src={imageUrl(p.imageUrl)}
                    alt=""
                    loading="lazy"
                    onLoad={(e) => {
                      e.currentTarget.style.visibility = 'visible';
                    }}
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <Utensils size={22} />
                )}
              </button>
              <button
                type="button"
                className="sofra-dish-main"
                onClick={() => onProductOpen?.(p.id)}
              >
                <span className="sofra-dish-copy">
                  <strong>{p.name}</strong>
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
      </section>
    );
  }
  return (
    <div
      className="sofra table-world table-menu"
      dir={['ar', 'he', 'fa', 'ur'].includes(lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <TableReceipt lang={lang} />
      <header className="table-masthead">
        <SofraBrand restaurant={restaurant} config={config} onBrandEdit={onBrandEdit} />
        <div className="table-header-tools">{headerTools}</div>
      </header>
      <nav
        className="table-categories sofra-categories"
        aria-label={en ? 'Categories' : 'Kategoriler'}
      >
        <button
          type="button"
          className={activeGroup == null ? 'is-active' : ''}
          onClick={() => onGroupChange?.(null)}
        >
          <SofraText field="picksLabel" value={copy.picksLabel} onTextEdit={onTextEdit} />
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={activeGroup === g.id ? 'is-active' : ''}
            onClick={() => onGroupChange?.(g.id)}
          >
            {g.name}
          </button>
        ))}
      </nav>
      <div className="table-menu__heading">
        <div>
          <SofraText as="h1" field="menuTitle" value={copy.menuTitle} onTextEdit={onTextEdit} />
          <SofraText
            as="p"
            className="table-eyebrow"
            field="menuEyebrow"
            value={copy.menuEyebrow}
            onTextEdit={onTextEdit}
          />
        </div>
        <label className="sofra-search">
          <Search size={17} />
          <input
            type="search"
            aria-label={en ? 'Search menu' : 'Menüde ara'}
            placeholder={en ? 'Search menu' : 'Menüde ara'}
            value={search || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </label>
      </div>
      <div className="table-menu__body">
        <div className="table-menu__stage">
          <TablePresentation
            variant="menu"
            lang={lang}
            item={loading || error ? undefined : featured}
            onActivate={featured ? () => onProductOpen?.(featured.id) : undefined}
          />
          {featured && !loading && !error && (
            <div className="table-menu__featured">
              <div>
                <h2>{featured.name}</h2>
                {featured.description && <p>{featured.description}</p>}
              </div>
              <div className="table-menu__featured-actions">
                <span>{formatMoney(featured.price, featured.currency)}</span>
                <button type="button" onClick={() => onProductOpen?.(featured.id)}>
                  {en ? 'Explore dish' : 'Tabağı keşfet'}
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}
          <div className="table-menu__index">
            <span>{String(rows.length ? current + 1 : 0).padStart(2, '0')}</span>
            <i>/</i>
            {String(rows.length).padStart(2, '0')}
            <span className="table-menu__index-line" />
            {featured?.name || copy.picksLabel}
          </div>
          {rows.length > 1 && (
            <div className="table-menu__stepper">
              <button
                type="button"
                aria-label={en ? 'Previous dish' : 'Önceki tabak'}
                disabled={current === 0}
                onClick={() => setSelected(current - 1)}
              >
                <ArrowLeft size={19} />
              </button>
              <button
                type="button"
                aria-label={en ? 'Next dish' : 'Sonraki tabak'}
                disabled={current === rows.length - 1}
                onClick={() => setSelected(current + 1)}
              >
                <ArrowRight size={19} />
              </button>
            </div>
          )}
          {onImageEdit && (
            <span className="table-photo-edit">
              {en
                ? 'Plate photos come from Products.'
                : 'Tabak görselleri Ürünler sayfasından alınır.'}
            </span>
          )}
        </div>
        <aside className="table-directory" aria-label={en ? 'Dishes' : 'Yemekler'}>
          <div className="table-directory__heading">
            <span>{en ? 'ON THE TABLE' : 'SOFRADA NELER VAR?'}</span>
            <small>
              {rows.length} {en ? 'dishes' : 'lezzet'}
            </small>
          </div>
          <div className="table-directory__scroll">
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
                {activeGroup != null && (
                  <h2 className="sofra-active-group">
                    {groups.find((g) => g.id === activeGroup)?.name}
                  </h2>
                )}
                {renderList(products)}
                {subgroups?.map((g) => renderList(g.products, g.name))}
                {!rows.length && (
                  <p className="sofra-empty">
                    {en ? 'No dishes found.' : 'Bu seçimde ürün bulunamadı.'}
                  </p>
                )}
              </>
            )}
            <div className="table-menu__extras">
              {beforeContent}
              {afterContent}
            </div>
          </div>
          <footer>
            <SofraText field="footerText" value={copy.footerText} onTextEdit={onTextEdit} />
          </footer>
        </aside>
      </div>
    </div>
  );
}
