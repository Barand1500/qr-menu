import { useEffect, useRef, useState } from 'react';
import { Mail, MapPin, MessageCircle, Phone, X } from 'lucide-react';
import './login-welcome.css';

type Office = {
  id: string;
  tab: string;
  name: string;
  person?: string;
  phones: { label: string; value: string }[];
  whatsapp?: string;
  emails: string[];
  address: string;
  company?: { label: string; value: string }[];
};

const OFFICES: Office[] = [
  {
    id: 'merkez',
    tab: 'Merkez',
    name: 'Merkez · Nevşehir',
    phones: [
      { label: 'Telefon', value: '+90 850 885 12 60' },
      { label: 'GSM', value: '+90 540 885 12 60' },
    ],
    emails: ['destek@vetahsilat.com', 'bilgi@vetahsilat.com'],
    address: '2000 Evler Mah. Üniversite Alanı No:13/131 Merkez / Nevşehir',
    company: [
      { label: 'Ünvan', value: 'GÜZEL İÇ VE DIŞ TİC. LTD. ŞTİ.' },
      { label: 'Vergi', value: 'Antalya Kurumlar / 9250508945' },
    ],
  },
  {
    id: 'magaza',
    tab: 'Antalya Mağaza',
    name: 'Antalya Mağaza / Showroom',
    person: 'Sercan Güzel',
    phones: [
      { label: 'GSM', value: '+90 542 104 60 60' },
      { label: 'Telefon', value: '+90 850 885 11 60' },
    ],
    whatsapp: '905438851160',
    emails: ['sercan@guzelteknoloji.com', 'bilgi@guzelteknoloji.com'],
    address: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. 130A Kepez / Antalya',
  },
  {
    id: 'yazilim',
    tab: 'Yazılım Ofisi',
    name: 'Antalya Yazılım Geliştirme Ofisi',
    person: 'Semihcan Güzel',
    phones: [
      { label: 'GSM', value: '+90 542 105 60 60' },
      { label: 'Telefon', value: '+90 850 885 11 60' },
    ],
    whatsapp: '905438851160',
    emails: ['semihcan@guzelteknoloji.com', 'bilgi@guzelteknoloji.com'],
    address: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. 130A Kepez / Antalya',
  },
  {
    id: 'arge',
    tab: 'AR-GE',
    name: 'Nevşehir Teknopark AR-GE Ofisi',
    person: 'Ercan Güzel',
    phones: [
      { label: 'GSM', value: '+90 532 567 46 60' },
      { label: 'Telefon', value: '+90 850 885 12 60' },
    ],
    whatsapp: '905408851260',
    emails: ['ercan@guzelteknoloji.com', 'arge@guzelteknoloji.com'],
    address: '2000 Evler Mah. Üniversite Alanı No:13/131 Merkez / Nevşehir',
  },
];

const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, '')}`;

/** Giriş sorunları için iletişim penceresi: ofis sekmeleri + tek dokunuşla ara / yaz / haritada aç. */
export default function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState(OFFICES[0].id);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    setActive(OFFICES[0].id);
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const o = OFFICES.find((x) => x.id === active) ?? OFFICES[0];

  return (
    <div className="lc" role="dialog" aria-modal="true" aria-labelledby="lc-title">
      <div className="lc__scrim" />
      <div className="lc__panel">
        <span className="lc__grab" aria-hidden />
        <header className="lc__head">
          <div>
            <h2 id="lc-title">Size yardımcı olalım</h2>
            <p>Giriş yaparken sorun yaşıyorsanız bize ulaşın.</p>
          </div>
          <button ref={closeBtn} type="button" className="lc__x" onClick={onClose} aria-label="Kapat">
            <X size={20} />
          </button>
        </header>

        <div className="lc-tabs" role="tablist" aria-label="Ofisler">
          {OFFICES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === active}
              className={x.id === active ? 'is-active' : ''}
              onClick={() => setActive(x.id)}
            >
              {x.tab}
            </button>
          ))}
        </div>

        <div className="lc__body" key={o.id}>
          <div className="lc-title">
            <h3>{o.name}</h3>
            {o.person ? <p>{o.person}</p> : null}
          </div>

          <div className="lc-actions">
            <a className="is-call" href={tel(o.phones[0].value)}>
              <Phone size={18} /> Ara
            </a>
            {o.whatsapp ? (
              <a className="is-wa" href={`https://wa.me/${o.whatsapp}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} /> WhatsApp
              </a>
            ) : null}
            <a className="is-mail" href={`mailto:${o.emails[0]}`}>
              <Mail size={18} /> E-posta
            </a>
          </div>

          <dl className="lc-rows">
            {o.phones.map((p) => (
              <div key={p.label + p.value}>
                <dt>{p.label}</dt>
                <dd>
                  <a href={tel(p.value)}>{p.value}</a>
                </dd>
              </div>
            ))}
            {o.emails.map((m) => (
              <div key={m}>
                <dt>E-posta</dt>
                <dd>
                  <a href={`mailto:${m}`}>{m}</a>
                </dd>
              </div>
            ))}
            <div>
              <dt>Adres</dt>
              <dd>
                {o.address}
                <a
                  className="lc-map"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={14} /> Haritada aç
                </a>
              </dd>
            </div>
            {o.company?.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
