import { memo } from 'react';
import { Link } from 'react-router-dom';
import { adminPath } from '@/lib/adminPath';
import {
  Megaphone,
  Pencil,
  Plus,
  QrCode,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Spinner } from '@/components/ui';
import { Stepper } from './Dialogs';
import {
  resolveColor,
  type CampaignRow,
  type TableGroup,
  type TableStyle,
} from './qr';

const TableTile = memo(function TableTile({
  n,
  style,
  url,
  logo,
  selected,
  call,
  onSelect,
}: {
  n: number;
  style: TableStyle;
  url: string;
  logo: string;
  selected: boolean;
  call: boolean;
  onSelect: (n: number) => void;
}) {
  const c = resolveColor(style.colorId);
  return (
    <button
      type="button"
      className={`bq-tile${selected ? ' is-selected' : ''}${call ? ' is-call' : ''}`}
      aria-pressed={selected}
      style={{ '--i': n % 14 } as React.CSSProperties}
      onClick={() => onSelect(n)}
    >
      <span className="bq-tile__qr" style={{ background: c.bg }}>
        <QRCodeSVG
          value={url}
          size={96}
          level="M"
          marginSize={4}
          fgColor={c.fg}
          bgColor={c.bg}
          imageSettings={
            style.withLogo && logo
              ? { src: logo, height: 24, width: 24, excavate: true }
              : undefined
          }
        />
      </span>
      <span className="bq-tile__name">{style.name}</span>
    </button>
  );
});

export function TablesTargets({
  groups,
  active,
  tables,
  selected,
  logo,
  callCode,
  styleOf,
  urlOf,
  codeOf,
  canDelete,
  onGroup,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onCount,
  onSelect,
}: {
  groups: TableGroup[];
  active: TableGroup;
  tables: number[];
  selected: number | null;
  logo: string;
  callCode: string | null;
  styleOf: (n: number) => TableStyle;
  urlOf: (n: number) => string;
  codeOf: (n: number) => string;
  canDelete: boolean;
  onGroup: (id: string) => void;
  onAddGroup: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onCount: (n: number) => void;
  onSelect: (n: number) => void;
}) {
  return (
    <section className="bq-card-panel">
      <div className="bq-chips" role="group" aria-label="Masa grubu">
        {groups.map((g) => (
          <button
            type="button"
            key={g.id}
            aria-pressed={g.id === active.id}
            onClick={() => onGroup(g.id)}
          >
            {g.name}
            <small>{g.count}</small>
          </button>
        ))}
        <button type="button" className="bq-chip-add" onClick={onAddGroup}>
          <Plus size={16} /> Grup
        </button>
      </div>
      <div className="bq-grouptools">
        <div className="bq-field bq-field--inline">
          <div className="bq-field__label">
            <span>Masa sayısı</span>
          </div>
          <Stepper
            label="Masa sayısı"
            value={active.count}
            min={1}
            max={60}
            onChange={onCount}
          />
        </div>
        <div className="bq-grouptools__btns">
          <button type="button" className="bq-tool" onClick={onEditGroup}>
            <Pencil size={17} />
            <span>Düzenle</span>
          </button>
          {canDelete && (
            <button
              type="button"
              className="bq-tool bq-tool--danger"
              aria-label={`${active.name} grubunu sil`}
              onClick={onDeleteGroup}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
      <div
        className="bq-tiles"
        role="group"
        aria-label={`${active.name} masaları`}
      >
        {tables.map((n) => (
          <TableTile
            key={`${active.id}-${n}`}
            n={n}
            style={styleOf(n)}
            url={urlOf(n)}
            logo={logo}
            selected={selected === n}
            call={callCode === codeOf(n)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function CampaignTargets({
  state,
  campaigns,
  selectedId,
  origin,
  onSelect,
  onAdd,
  onMenu,
  onDelete,
  onRetry,
}: {
  state: 'loading' | 'ready' | 'error';
  campaigns: CampaignRow[];
  selectedId: number | null;
  origin: string;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onMenu: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  if (state === 'loading')
    return (
      <section className="bq-card-panel">
        <Spinner />
      </section>
    );
  if (state === 'error')
    return (
      <section className="bq-card-panel bq-empty" role="alert">
        <p>Kampanyalar alınamadı.</p>
        <button type="button" className="bq-tool" onClick={onRetry}>
          <RotateCw size={17} /> Tekrar dene
        </button>
      </section>
    );
  if (!campaigns.length)
    return (
      <section className="bq-card-panel bq-empty">
        <Megaphone size={34} aria-hidden="true" />
        <h2>Her kampanyaya kendi QR’ı</h2>
        <p>
          Bir kampanya ekle, özel menüsünü hazırla; müşteri QR’ı okutunca sadece
          o menüyü görsün.
        </p>
        <button type="button" className="bq-primary" onClick={onAdd}>
          <Plus size={18} /> İlk kampanyayı ekle
        </button>
      </section>
    );
  const selected = campaigns.find((c) => c.id === selectedId) || null;
  return (
    <section className="bq-card-panel">
      <div
        className="bq-tiles bq-tiles--wide"
        role="group"
        aria-label="Kampanyalar"
      >
        {campaigns.map((c, i) => (
          <button
            type="button"
            key={c.id}
            className={`bq-tile bq-tile--campaign${selectedId === c.id ? ' is-selected' : ''}`}
            aria-pressed={selectedId === c.id}
            style={{ '--i': i % 14 } as React.CSSProperties}
            onClick={() => onSelect(c.id)}
          >
            <span className="bq-tile__qr">
              <QRCodeSVG
                value={`${origin}/menu?kampanya=${encodeURIComponent(c.slug)}`}
                size={96}
                level="M"
                marginSize={4}
              />
            </span>
            <span className="bq-tile__name">{c.name}</span>
            <small>
              {c.itemCount > 0 ? `${c.itemCount} ürün` : 'Menü yok'}
            </small>
          </button>
        ))}
        <button type="button" className="bq-tile bq-tile--add" onClick={onAdd}>
          <span className="bq-tile__qr">
            <Plus size={26} />
          </span>
          <span className="bq-tile__name">Yeni kampanya</span>
        </button>
      </div>
      {selected && (
        <div className="bq-grouptools">
          <p className="bq-grouptools__text">
            <QrCode size={16} aria-hidden="true" />
            <strong>{selected.name}</strong>
            <span>
              {selected.itemCount > 0
                ? `${selected.itemCount} ürünlük özel menü`
                : 'Özel menü henüz boş'}
            </span>
          </p>
          <div className="bq-grouptools__btns">
            <button type="button" className="bq-tool" onClick={onMenu}>
              <Megaphone size={17} />
              <span>Özel menü</span>
            </button>
            <button
              type="button"
              className="bq-tool bq-tool--danger"
              aria-label={`${selected.name} kampanyasını sil`}
              onClick={onDelete}
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function Upsell({ what }: { what: string }) {
  return (
    <section className="bq-upsell">
      <span className="bq-upsell__badge">QR PAKETİ</span>
      <h2>{what} QR paketiyle açılır</h2>
      <p>
        Sade siyah QR ücretsiz. Renk, çerçeve, logo, masa ve kampanya QR’ları,
        toplu yazdırma için paketi Eklentiler bölümünde Kod Gir ile aç.
      </p>
      <Link to={adminPath('extensions', 'qr')} className="bq-primary">
        Eklentilere git
      </Link>
    </section>
  );
}
