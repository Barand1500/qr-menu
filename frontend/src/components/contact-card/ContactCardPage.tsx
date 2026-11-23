import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { contactCardCopy } from '@/lib/contactCardCopy';
import type { ContactCardConfig } from '@/lib/contactCard';
import ContactCardView, { type ContactCardRestaurant } from './ContactCardView';
import './contact-card-page.css';

/** Menüdeki "İletişim" sayfası: telefonda dikey, geniş ekranda yatay kart. */
export default function ContactCardPage({
  card,
  restaurant,
  lang,
  onBack,
}: {
  card: ContactCardConfig;
  restaurant: ContactCardRestaurant;
  lang: string;
  onBack: () => void;
}) {
  const t = contactCardCopy(lang);
  const wide = useMediaQuery('(min-width: 760px)');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <section className="cc-page" aria-label={t.title}>
      <button type="button" className="cc-page__back" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        {t.back}
      </button>
      <h1 className="cc-page__title">{t.title}</h1>
      <ContactCardView
        card={card}
        restaurant={restaurant}
        lang={lang}
        layout={wide ? 'landscape' : 'portrait'}
        menuUrl={`${window.location.origin}/menu`}
      />
    </section>
  );
}
