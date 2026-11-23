import { useEffect, useMemo, useState } from 'react';
import { Eye, Save, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import AdminToast, { type AdminToastNotice } from '@/components/admin/AdminToast';
import VisibilityToggle from '@/components/admin/VisibilityToggle';
import ContactCardView, { type ContactCardLayout } from '@/components/contact-card/ContactCardView';
import ContactMapPicker from '@/components/contact-card/ContactMapPicker';
import SignaturePad from '@/components/contact-card/SignaturePad';
import { Button, Input, PageHeader, Spinner } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { api } from '@/lib/api';
import {
  CONTACT_CARD_DEFAULTS,
  CONTACT_CARD_PALETTES,
  CONTACT_CARD_TONES,
  contactCardHasContent,
  normalizeContactCard,
  type ContactCardConfig,
} from '@/lib/contactCard';
import './contact-card-admin.css';

type Restaurant = { name: string; slug: string; logoUrl: string | null };
type Payload = { card: ContactCardConfig; restaurant: Restaurant | null };

export default function ContactCardAdminPage() {
  const [card, setCard] = useState<ContactCardConfig>(CONTACT_CARD_DEFAULTS);
  const [saved, setSaved] = useState('');
  const [restaurant, setRestaurant] = useState<Restaurant>({ name: 'Restoran', slug: '', logoUrl: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const [sheet, setSheet] = useState(false);
  const [device, setDevice] = useState<ContactCardLayout>('portrait');
  const wide = useMediaQuery('(min-width: 1100px)');
  // Konum izni için kayıtlı nokta: haritada başlangıç ve tek dokunuşla kullanım için hatırlanır
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let alive = true;
    api<Payload>('/api/admin/settings/contact-card')
      .then((data) => {
        if (!alive) return;
        setCard(data.card);
        setSaved(JSON.stringify(data.card));
        if (data.restaurant) setRestaurant(data.restaurant);
      })
      .catch(() => alive && setNotice({ text: 'Kart bilgileri yüklenemedi.', error: true }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ enabled: boolean; lat: number; lng: number }>('/api/admin/settings/geo-lock')
      .then((g) => {
        if (alive && g.enabled && Number.isFinite(g.lat) && Number.isFinite(g.lng)) setHome({ lat: g.lat, lng: g.lng });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const dirty = JSON.stringify(card) !== saved;
  const set = <K extends keyof ContactCardConfig>(key: K, value: ContactCardConfig[K]) =>
    setCard((prev) => ({ ...prev, [key]: value }));

  // Önizleme, müşterinin göreceği temiz (doğrulanmış) kartı gösterir
  const preview = useMemo(() => normalizeContactCard(card), [card]);
  const empty = !contactCardHasContent(preview);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await api<Payload>('/api/admin/settings/contact-card', {
        method: 'PUT',
        body: JSON.stringify({ card }),
      });
      setCard(data.card);
      setSaved(JSON.stringify(data.card));
      setNotice({
        text: data.card.enabled && contactCardHasContent(data.card) ? 'Kart kaydedildi, menüde görünüyor.' : 'Kart kaydedildi.',
        error: false,
      });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Kart kaydedilemedi.', error: true });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const phoneLike = { inputMode: 'tel' as const, autoComplete: 'off', maxLength: 30 };

  const cardPreview = (layout: ContactCardLayout) => (
    <ContactCardView
      card={preview}
      restaurant={restaurant}
      layout={layout}
      actions={false}
      menuUrl={`${window.location.origin}/menu`}
    />
  );

  return (
    <div className="ccp">
      <PageHeader
        title="İletişim Kartı"
        subtitle="Müşteriler menüde bu kartı görür; indirebilir ve paylaşabilir."
        actions={
          <Button onClick={() => void save()} disabled={saving || !dirty} className="ccp__save">
            <Save size={16} aria-hidden="true" /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        }
      />

      <div className="ccp__grid">
        <div className="ccp__form">
          <section className="ccp__panel ccp__switch">
            <div>
              <strong>Menüde göster</strong>
              <small>
                {empty
                  ? 'Önce en az bir bilgi doldurun; boş kart müşteriye gösterilmez.'
                  : 'Açıkken menüdeki “İletişim” sayfası görünür.'}
              </small>
            </div>
            <VisibilityToggle
              checked={card.enabled}
              label="İletişim kartı menüde görünsün"
              disabled={saving}
              onToggle={() => set('enabled', !card.enabled)}
            />
          </section>

          <section className="ccp__panel">
            <h2>Yönetici</h2>
            <div className="ccp__row">
              <Input label="Yönetici adı" value={card.managerName} maxLength={60} onChange={(e) => set('managerName', e.target.value)} />
              <Input label="Görevi" value={card.managerTitle} maxLength={60} onChange={(e) => set('managerTitle', e.target.value)} />
            </div>
          </section>

          <section className="ccp__panel">
            <h2>İletişim</h2>
            <div className="ccp__row">
              <Input label="Telefon" value={card.phone} {...phoneLike} onChange={(e) => set('phone', e.target.value)} />
              <Input label="WhatsApp" value={card.whatsapp} {...phoneLike} onChange={(e) => set('whatsapp', e.target.value)} />
            </div>
            <div className="ccp__row">
              <Input label="E-posta" type="email" value={card.email} maxLength={120} onChange={(e) => set('email', e.target.value)} />
              <Input label="Web sitesi" value={card.website} maxLength={200} onChange={(e) => set('website', e.target.value)} />
            </div>
          </section>

          <section className="ccp__panel">
            <h2>Konum ve saatler</h2>
            <Input label="Adres" value={card.address} maxLength={200} onChange={(e) => set('address', e.target.value)} />
            <p className="ccp__help">
              Konumu iki yoldan verebilirsiniz: haritada arayıp iğneyi bırakın (menüde harita görünür) ya da aşağıya bağlantı yapıştırın.
            </p>
            <ContactMapPicker
              lat={card.lat}
              lng={card.lng}
              home={home}
              disabled={saving}
              onChange={(p) => setCard((prev) => ({ ...prev, lat: p ? p.lat : null, lng: p ? p.lng : null }))}
            />
            <Input label="Harita bağlantısı (isteğe bağlı)" value={card.mapUrl} maxLength={500} onChange={(e) => set('mapUrl', e.target.value)} />
            <p className="ccp__help">
              Bağlantı varsa “Yol tarifi” düğmesi onu açar. Boşsa seçtiğiniz iğne, o da yoksa adres kullanılır.
            </p>
            <Input label="Çalışma saatleri" value={card.hours} maxLength={80} placeholder="Her gün 09:00 – 23:00" onChange={(e) => set('hours', e.target.value)} />
          </section>

          <section className="ccp__panel">
            <h2>Kart görünümü</h2>
            <Input label="Slogan" value={card.tagline} maxLength={80} onChange={(e) => set('tagline', e.target.value)} />
            <div className="ccp__tones" role="radiogroup" aria-label="Kart rengi">
              {CONTACT_CARD_TONES.map((tone) => {
                const p = CONTACT_CARD_PALETTES[tone];
                return (
                  <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={card.tone === tone}
                    className={card.tone === tone ? 'is-active' : ''}
                    onClick={() => set('tone', tone)}
                  >
                    <i style={{ background: `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]})`, boxShadow: `inset 0 0 0 3px ${p.accent}` }} />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ccp__panel">
            <h2>İmza</h2>
            <SignaturePad strokes={card.signature} onChange={(next) => set('signature', next)} disabled={saving} />
          </section>
        </div>

        {wide ? (
          <aside className="ccp__preview" aria-label="Kart önizlemesi">
            <div className="ccp__device" role="group" aria-label="Önizleme cihazı">
              <button type="button" className={device === 'portrait' ? 'is-active' : ''} onClick={() => setDevice('portrait')}>
                Telefon
              </button>
              <button type="button" className={device === 'landscape' ? 'is-active' : ''} onClick={() => setDevice('landscape')}>
                Bilgisayar
              </button>
            </div>
            <div className={`ccp__stage${device === 'landscape' ? ' is-wide' : ''}`}>{cardPreview(device)}</div>
            <p className="ccp__tip">Kartı çevirmek için tıklayın.</p>
          </aside>
        ) : null}
      </div>

      {!wide ? (
        <div className="ccp__bar">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            <Eye size={17} aria-hidden="true" /> Önizle
          </Button>
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            <Save size={16} aria-hidden="true" /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      ) : null}

      {sheet && !wide ? (
        <AdminOverlay label="Kart önizlemesi" className="ccp-overlay" onClose={() => setSheet(false)}>
          <div className="ccp-sheet">
            <header>
              <strong>Önizleme</strong>
              <button type="button" onClick={() => setSheet(false)} aria-label="Kapat">
                <X size={20} />
              </button>
            </header>
            <div className="ccp-sheet__body">{cardPreview('portrait')}</div>
          </div>
        </AdminOverlay>
      ) : null}

      <AdminToast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
