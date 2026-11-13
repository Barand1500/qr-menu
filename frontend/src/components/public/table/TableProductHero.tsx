import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import DesktopTableSurface from './DesktopTableSurface';
import TablePresentation from './TablePresentation';
import TableReceipt from './TableReceipt';
import './table.css';

export default function TableProductHero({
  fallback,
  image,
  name,
  id,
  ingredients,
  lang = 'tr',
}: {
  fallback: ReactNode;
  image?: string;
  name: string;
  id: number;
  ingredients?: string;
  lang?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DesktopTableSurface fallback={fallback}>
      <div className="table-product-hero">
        <TableReceipt lang={lang} />
        <TablePresentation
          variant="detail"
          item={{ id, imageUrl: image, name }}
          lang={lang}
          photo={fallback}
        />
        {ingredients && (
          <div className="table-ingredients">
            <button
              type="button"
              className="table-ingredients__toggle"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Plus size={15} /> {lang.startsWith('en') ? 'Ingredients' : 'İçindekiler'}
            </button>
            {open && (
              <div className="table-ingredients__note" role="note">
                <button
                  type="button"
                  aria-label={
                    lang.startsWith('en') ? 'Close ingredients' : 'İçerik bilgisini kapat'
                  }
                  onClick={() => setOpen(false)}
                >
                  <X size={14} />
                </button>
                <span>{lang.startsWith('en') ? 'IN THIS DISH' : 'BU TABAKTA'}</span>
                <p>{ingredients}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DesktopTableSurface>
  );
}
