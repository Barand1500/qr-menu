import { useState, type CSSProperties } from 'react';
import { AlertTriangle, Plus, UtensilsCrossed } from 'lucide-react';
import { ingredientEmoji, parseIngredients } from '@/lib/ingredientChips';

const SHOW_FIRST = 12;

/**
 * İçindekiler / alerjenler: serbest metin küçük etiketlere bölünür (temel malzemeler ve isteğe göre eklenenler ayrı).
 * Metin liste gibi değilse eski düz yazı kartı gösterilir.
 */
export default function IngredientCard({
  text,
  kind,
  en = false,
}: {
  text: string;
  kind: 'ingredients' | 'allergens';
  en?: boolean;
}) {
  const warn = kind === 'allergens';
  const [open, setOpen] = useState(false);
  const parsed = parseIngredients(text, !warn);
  const title = warn ? (en ? 'Allergens' : 'Alerjenler') : en ? 'Ingredients' : 'İçindekiler';
  const Icon = warn ? AlertTriangle : UtensilsCrossed;

  if (!parsed) {
    return (
      <section className={`pd-fact${warn ? ' pd-fact--warn' : ''}`}>
        <h2>
          <Icon size={15} />
          {title}
        </h2>
        <p>{text}</p>
      </section>
    );
  }

  const total = parsed.main.length + parsed.extra.length;
  const limit = open ? Infinity : SHOW_FIRST;
  const main = parsed.main.slice(0, limit);
  const extra = parsed.extra.slice(0, Math.max(0, limit - parsed.main.length));
  const hidden = total - main.length - extra.length;
  let n = 0;

  const chip = (name: string, isExtra: boolean) => {
    const emoji = isExtra || warn ? '' : ingredientEmoji(name);
    return (
      <li key={name} className={`pd-ing__chip${isExtra ? ' is-extra' : ''}`} style={{ ['--i' as string]: n++ } as CSSProperties}>
        {isExtra ? <Plus size={12} strokeWidth={2.6} aria-hidden="true" /> : emoji ? <span className="pd-ing__emoji" aria-hidden="true">{emoji}</span> : <i className="pd-ing__dot" aria-hidden="true" />}
        {name}
      </li>
    );
  };

  return (
    <section className={`pd-ing${warn ? ' pd-ing--warn' : ''}`}>
      <header className="pd-ing__head">
        <h2>
          <Icon size={15} />
          {title}
        </h2>
        <span className="pd-ing__count">{total}</span>
      </header>

      {main.length ? (
        <div className="pd-ing__group">
          {!warn && parsed.extra.length ? <h3>{en ? 'Main ingredients' : 'Temel malzemeler'}</h3> : null}
          <ul>{main.map((x) => chip(x, false))}</ul>
        </div>
      ) : null}
      {extra.length ? (
        <div className="pd-ing__group pd-ing__group--extra">
          <h3>{en ? 'May be added' : 'İsteğe göre eklenebilir'}</h3>
          <ul>{extra.map((x) => chip(x, true))}</ul>
        </div>
      ) : null}

      {total > SHOW_FIRST ? (
        <button type="button" className="pd-ing__more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? (en ? 'Show less' : 'Daha az göster') : en ? `+${hidden} more` : `+${hidden} tane daha`}
        </button>
      ) : null}
    </section>
  );
}
