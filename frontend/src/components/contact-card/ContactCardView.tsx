import MenuShareButton from '@/components/public/share/MenuShareButton';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type PointerEvent as ReactPointerEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Mail, MapPin, MessageCircle, Phone, RotateCw, Share2, Download } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import {
  CONTACT_CARD_PALETTES,
  cardNumber,
  contactCardMapUrl,
  contactCardWhatsappUrl,
  signatureTimeline,
  type ContactCardConfig,
} from '@/lib/contactCard';
import { contactCardCopy, type ContactCardCopy } from '@/lib/contactCardCopy';
import { renderContactCardImage } from './contactCardImage';
import ContactShareBurst from './ContactShareBurst';
import ContactMiniMap from './ContactMiniMap';
import ContactCardSignature from './ContactCardSignature';
import './contact-card.css';

export type ContactCardLayout = 'portrait' | 'landscape';

export type ContactCardRestaurant = { name: string; logoUrl?: string | null; slug?: string };

export type ContactCardField = { key: string; label: string; value: string; sub?: string };

/** Kartta görünen alanlar: boş olanlar hiç gösterilmez. */
export function contactCardFields(card: ContactCardConfig, t: ContactCardCopy): ContactCardField[] {
  const rows: ContactCardField[] = [
    { key: 'phone', label: t.phone, value: card.phone },
    { key: 'whatsapp', label: t.whatsapp, value: card.whatsapp },
    { key: 'email', label: t.email, value: card.email },
    { key: 'web', label: t.web, value: card.website.replace(/^https?:\/\//, '').replace(/\/$/, '') },
    { key: 'address', label: t.address, value: card.address || card.placeLabel },
    { key: 'hours', label: t.hours, value: card.hours },
  ];
  const shown = rows.filter((r) => r.value);
  // Ayrıntılı yer adı ayrı alan olmaz: son satırın (genelde saatler) altında küçük yazılır
  if (card.address && card.placeLabel && shown.length) shown[shown.length - 1].sub = card.placeLabel;
  return shown;
}

type Props = {
  card: ContactCardConfig;
  restaurant: ContactCardRestaurant;
  lang?: string;
  layout: ContactCardLayout;
  /** Kaydet / Paylaş / Ara düğmeleri (yönetim önizlemesinde kapalı) */
  actions?: boolean;
  /** Menü adresi (arka yüzdeki QR) */
  menuUrl: string;
  /** Paylaşılan bağlantı (doğrudan iletişim kartını açar); yoksa menuUrl */
  shareUrl?: string;
};

export default function ContactCardView({ card, restaurant, lang = 'tr', layout, actions = true, menuUrl, shareUrl }: Props) {
  const link = shareUrl || menuUrl;
  const t = contactCardCopy(lang);
  const palette = CONTACT_CARD_PALETTES[card.tone];
  const fields = useMemo(() => contactCardFields(card, t), [card, t]);
  const [flipped, setFlipped] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [status, setStatus] = useState<'' | 'save' | 'share' | 'copy' | 'fail'>('');
  const [busy, setBusy] = useState<'' | 'save' | 'share'>('');
  const [burst, setBurst] = useState<'closed' | 'open' | 'closing'>('closed');
  const tiltRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const number = cardNumber(restaurant.slug || restaurant.name);
  const hasSignature = card.signature.length > 0;
  const hasMap = typeof card.lat === 'number' && typeof card.lng === 'number';
  const signatureStart = 1.05;
  const timeline = useMemo(() => signatureTimeline(card.signature, signatureStart), [card.signature]);

  // Bu kartın görünümü değişince animasyon baştan oynar (yönetimde canlı önizleme için)
  const signatureKey = card.signature.join('|');
  useEffect(() => {
    setPlayKey((k) => k + 1);
  }, [signatureKey]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flash(next: typeof status) {
    setStatus(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(''), 2200);
  }

  function flip() {
    setFlipped((f) => {
      if (f) setPlayKey((k) => k + 1); // öne dönünce imza yeniden yazılır
      return !f;
    });
  }

  function tilt(event: ReactPointerEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const py = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    el.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 18).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    el.dataset.live = 'true';
  }
  function untilt() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.dataset.live = 'false';
  }

  async function makeImage() {
    return renderContactCardImage({
      card,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl ? imageUrl(restaurant.logoUrl) : null,
      photoUrl: card.photoUrl ? imageUrl(card.photoUrl) : null,
      layout,
      number,
      copy: t,
    });
  }

  async function save() {
    if (busy) return;
    setBusy('save');
    try {
      const blob = await makeImage();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(restaurant.slug || 'restoran').replace(/[^\w-]+/g, '-')}-karti.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash('save');
    } catch {
      flash('fail');
    } finally {
      setBusy('');
    }
  }

  function closeBurst() {
    setBurst((b) => (b === 'open' ? 'closing' : b));
    window.setTimeout(() => setBurst((b) => (b === 'closing' ? 'closed' : b)), 360);
  }

  /** Paylaş: bağlantıyı panoya kopyalar ve gönderme balonlarını açar (tekrar basınca kapatır). */
  async function toggleShare() {
    if (burst === 'open') {
      closeBurst();
      return;
    }
    setBurst('open');
    const copied = await copyText(link);
    flash(copied ? 'copy' : 'fail');
  }

  /** Tarayıcının kendi paylaşım penceresi: varsa kart resmiyle birlikte. */
  async function nativeShare() {
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    try {
      const blob = await makeImage().catch(() => null);
      const file = blob ? new File([blob], 'restoran-karti.png', { type: 'image/png' }) : null;
      const data: ShareData = { title: restaurant.name, text: `${restaurant.name} · ${t.shareText}`, url: link };
      if (file && nav.canShare?.({ files: [file] })) await nav.share({ ...data, files: [file] });
      else await nav.share(data);
      flash('share');
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') flash('fail');
    }
  }

  // Harita varsa çalışma saatleri haritanın altında yer alır
  const tailFields = hasMap ? fields.filter((f) => f.key === 'hours') : [];
  const mainFields = hasMap ? fields.filter((f) => f.key !== 'hours') : fields;
  const renderFields = (list: ContactCardField[]) =>
    list.length ? (
      <dl className="cc-fields">
      {list.map((f) => (
        <div key={f.key} data-field={f.key}>
          <dt>{f.label}</dt>
          <dd>
            {f.value}
            {f.sub ? <small>{f.sub}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
    ) : null;

  const mapUrl = contactCardMapUrl(card);
  const whatsappUrl = contactCardWhatsappUrl(card.whatsapp);
  const phoneHref = card.phone ? `tel:${card.phone.replace(/[^\d+]/g, '')}` : '';
  const quick = [
    phoneHref && { key: 'call', href: phoneHref, label: t.call, icon: <Phone size={18} /> },
    whatsappUrl && { key: 'wa', href: whatsappUrl, label: t.write, icon: <MessageCircle size={18} /> },
    card.email && { key: 'mail', href: `mailto:${card.email}`, label: t.mail, icon: <Mail size={18} /> },
    mapUrl && { key: 'map', href: mapUrl, label: t.location, icon: <MapPin size={18} /> },
  ].filter(Boolean) as { key: string; href: string; label: string; icon: ReactElement }[];

  const style = {
    '--cc-bg-a': palette.bg[0],
    '--cc-bg-b': palette.bg[1],
    '--cc-ink': palette.ink,
    '--cc-muted': palette.muted,
    '--cc-accent': palette.accent,
    '--cc-accent-2': palette.accent2,
    '--cc-paper': palette.paper,
    '--cc-signature-end': `${timeline.end}s`,
  } as CSSProperties;
  const initial = restaurant.name.trim().charAt(0).toLocaleUpperCase('tr') || '•';
  const statusText =
    status === 'save' ? t.saved : status === 'share' ? t.shared : status === 'copy' ? t.copied : status === 'fail' ? t.failed : '';

  return (
    <div className="cc" data-layout={layout} data-light={palette.light} style={style}>
      <div className="cc-wrap">
        <div className="cc-scene" onPointerMove={tilt} onPointerLeave={untilt} onPointerCancel={untilt}>
          <div className="cc-float">
            <div className="cc-tilt" ref={tiltRef}>
              <div
                className={`cc-flip${flipped ? ' is-flipped' : ''}`}
                data-map={hasMap}
                role="button"
                tabIndex={0}
                aria-label={t.flip}
                aria-pressed={flipped}
                onClick={flip}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    flip();
                  }
                }}
              >
                <article className="cc-face cc-front" aria-hidden={flipped}>
                  <i className="cc-foil" aria-hidden="true" />
                  <header className="cc-top">
                    <span>{t.cardKind}</span>
                    <span>№ {number}</span>
                  </header>

                  <div className="cc-id">
                    <span className="cc-logo">
                      {restaurant.logoUrl ? <img src={imageUrl(restaurant.logoUrl)} alt="" data-no-fit /> : <b>{initial}</b>}
                    </span>
                    <div className="cc-name">
                      <h2>{restaurant.name}</h2>
                      {card.tagline ? <p>{card.tagline}</p> : null}
                    </div>
                  </div>

                  {card.managerName || card.photoUrl ? (
                    <div className="cc-person">
                      <div className="cc-person__text">
                        {card.managerName ? (
                          <>
                            <small>{card.managerTitle ? `${t.manager} · ${card.managerTitle}` : t.manager}</small>
                            <strong>{card.managerName}</strong>
                          </>
                        ) : null}
                      </div>
                      {card.photoUrl ? (
                        <span className="cc-photo">
                          <img src={imageUrl(card.photoUrl)} alt="" data-no-fit />
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {fields.length || hasMap ? (
                    <div className="cc-side">
                      {renderFields(mainFields)}
                      {hasMap ? (
                        <ContactMiniMap lat={card.lat as number} lng={card.lng as number} href={contactCardMapUrl(card)} label={t.mapTitle} />
                      ) : null}
                      {renderFields(tailFields)}
                    </div>
                  ) : null}

                  {hasSignature ? (
                    <div className="cc-sign" key={playKey}>
                      <small>{t.signature}</small>
                      <ContactCardSignature items={timeline.items} />
                      <span className="cc-stamp" aria-hidden="true">
                        <b>{t.verified}</b>
                        <i>★</i>
                      </span>
                    </div>
                  ) : null}

                  <i className="cc-glare" aria-hidden="true" />
                </article>

                <article className="cc-face cc-back" aria-hidden={!flipped}>
                  <i className="cc-foil" aria-hidden="true" />
                  <span className="cc-stripe" aria-hidden="true" />
                  <div className="cc-qr">
                    <div className="cc-qr__box">
                      <QRCodeSVG value={menuUrl} size={256} level="M" marginSize={2} fgColor="#161210" bgColor="#ffffff" />
                    </div>
                    <p>{t.backTitle}</p>
                    <strong>{restaurant.name}</strong>
                  </div>
                  <i className="cc-glare" aria-hidden="true" />
                </article>
              </div>
            </div>
          </div>
        </div>

        <p className="cc-hint">
          <RotateCw size={14} aria-hidden="true" /> {t.hint}
        </p>

        {actions ? (
          <div className="cc-actions">
            {quick.length ? (
              <div className="cc-quick" style={{ ['--n' as string]: quick.length }}>
                {quick.map((q) => (
                  <a key={q.key} href={q.href} target={q.key === 'map' || q.key === 'wa' ? '_blank' : undefined} rel="noopener noreferrer">
                    {q.icon}
                    <span>{q.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {mapUrl && (
              <div className="cc-location-share">
                <MenuShareButton
                  url={mapUrl}
                  title={`${restaurant.name} · ${lang.startsWith('tr') ? 'Konum' : 'Location'}`}
                  lang={lang}
                  label={
                    lang.startsWith('tr') ? 'Konumu paylaş' : 'Share location'
                  }
                  showLabel
                />
              </div>
            )}
            <div className="cc-share">
              <button type="button" onClick={() => void save()} disabled={busy !== ''}>
                {status === 'save' ? <Check size={18} /> : <Download size={18} />}
                <span>{status === 'save' ? t.saved : t.save}</span>
              </button>
              <button
                type="button"
                className={`is-primary${burst === 'open' ? ' is-open' : ''}`}
                onClick={() => void toggleShare()}
                aria-expanded={burst === 'open'}
              >
                {status === 'share' || status === 'copy' ? <Check size={18} /> : <Share2 size={18} />}
                <span>{status === 'copy' ? t.copyLabel : status === 'share' ? t.shared : t.share}</span>
              </button>
            </div>
            {burst !== 'closed' ? (
              <ContactShareBurst
                url={link}
                text={`${restaurant.name} · ${t.shareText}`}
                copy={t}
                closing={burst === 'closing'}
                onNative={typeof navigator.share === 'function' ? () => void nativeShare() : undefined}
                onPick={closeBurst}
              />
            ) : null}
            <p className="cc-status" role="status" aria-live="polite">
              {status === 'fail' ? statusText : ''}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Panoya kopyalar; eski tarayıcılarda/güvenli olmayan bağlantıda gizli alanla dener. */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
