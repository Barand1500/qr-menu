import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import {
  CircleDot,
  ListChecks,
  Ban,
  Save,
  MousePointerClick,
  Layers3,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  UtensilsCrossed,
  SlidersHorizontal,
  Lightbulb,
} from 'lucide-react';

export type GuideStepId =
  | 'welcome'
  | 'pick'
  | 'idea'
  | 'single'
  | 'single-fields'
  | 'type-max'
  | 'multi'
  | 'multi-max'
  | 'exclude'
  | 'floor'
  | 'save';

export type GuideStep = {
  id: GuideStepId;
  title: string;
  /** Ana anlatım — birkaç cümle olabilir */
  body: string;
  /** Kısa maddeler */
  bullets?: string[];
  /** Alt ipucu */
  tip?: string;
  /** data-tour hedefi; yoksa ortada kart */
  target?: string;
  Icon: typeof Sparkles;
};

export const VARIANT_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Bu sayfa ne işe yarar?',
    body: 'Burada her ürüne özel sipariş seçenekleri kurarsın. Garson masadan sipariş eklerken bu seçenekler çıkar; fiyat da buna göre hesaplanır.',
    bullets: [
      'Tek seçim → boy, tür, porsiyon (birini seçersin)',
      'Ekstra + miktar → mantar ×2 gibi ekler',
      'İstersen boya göre ekstra limiti ve “A seçilince B gizlensin”',
    ],
    tip: 'Şimdi pizza örneğiyle adım adım kuracağız. Örnek kaydedilmez; bitince ekran eski haline döner.',
    Icon: Sparkles,
  },
  {
    id: 'pick',
    title: 'Önce ürünü seç',
    body: 'Soldaki listeden bir ürün seç. Seçenekler ürüne özeldir: Margarita’nın boyları ile Makarna’nın sosları aynı olmak zorunda değil.',
    bullets: [
      'Üründe önceden seçenek olması şart değil — boş ürüne de eklenir',
      'Rehber örnek için otomatik bir ürün seçer',
      'Gerçek kaydı etkilemez; sadece gösterim',
    ],
    tip: 'Kendi ürününde çalışırken soldan ürünü seçip sağda grup eklersin.',
    target: 'pv-list',
    Icon: MousePointerClick,
  },
  {
    id: 'idea',
    title: 'Örnek senaryo: pizza',
    body: 'Diyelim ki pizza satıyorsun. Müşteri önce boy seçsin, sonra üstüne ekstra eklesin. Büyük boyda en fazla 5 ekstra, Mega’da 7 ekstra olsun.',
    bullets: [
      '1) Boy grubu (tek seçim): Büyük / Mega',
      '2) Her boya ayrı ekstra limiti',
      '3) Ekstralar grubu: Mantar, Sucuk, Acılı…',
      '4) İstersen Acılı seçilince “Çocuk porsiyonu” gizlensin',
    ],
    tip: 'İleri’ye basınca bu senaryoyu ekranda parça parça kuracağız.',
    Icon: Lightbulb,
  },
  {
    id: 'single',
    title: 'Tek seçim grubu ekle',
    body: 'Sağ üstteki “Tek seçim” butonu boy / tür / porsiyon gibi “birini seç” alanları içindir. Müşteri aynı anda iki boy seçemez.',
    bullets: [
      'Grup adı örnekte: Boy',
      'Seçenekler: Büyük ve Mega',
      'Fiyat genelde “Fiyatı değiştir” olur — seçilen boy ürün fiyatının yerine geçer',
    ],
    tip: 'Makarna tipi, hamburger menü boyutu gibi şeyler de aynı mantık.',
    target: 'pv-add-single',
    Icon: CircleDot,
  },
  {
    id: 'single-fields',
    title: 'Grup satırındaki ayarlar',
    body: 'Her grubun üst satırında ne tür grup olduğu ve fiyatın nasıl işleneceği seçilir. Yanlış seçersen siparişte fiyat garip görünür.',
    bullets: [
      'Tek seçim / Çoklu + miktar → grup tipi',
      'Fiyatı değiştir → boy fiyatı taban olur',
      'Fiyata ekle → ürün fiyatına eklenir',
      'Zorunlu → siparişte boş bırakılamaz',
    ],
    tip: 'Boy için genelde: Tek seçim + Fiyatı değiştir + Zorunlu.',
    target: 'pv-groups',
    Icon: SlidersHorizontal,
  },
  {
    id: 'type-max',
    title: 'Boy’a göre ekstra limiti',
    body: 'İşte kritik nokta: ekstra üst sınırı her boy için farklı olabilir. Büyük’ün yanındaki “Ekstra”ya 5, Mega’ya 7 yaz. Siparişte o boy seçilince limit otomatik uygulanır.',
    bullets: [
      'Büyük → Ekstra 5 (en fazla 5 adet ekstra)',
      'Mega → Ekstra 7',
      '∞ / boş → bu boy özel limit koymaz',
      'Özel limit yoksa ekstralar grubundaki genel “Maks” geçerli olur',
    ],
    tip: 'Limit sadece “çoklu ekstra” gruplarına uygulanır; boy seçimini kısıtlamaz.',
    target: 'pv-groups',
    Icon: Layers3,
  },
  {
    id: 'multi',
    title: 'Ekstra + miktar grubu',
    body: 'Şimdi “Ekstra + miktar” ile malzemeleri ekliyoruz. Burada her seçenek ayrı ayrı artırılıp azaltılabilir: Mantar 2, Sucuk 1 gibi.',
    bullets: [
      'Grup adı örnekte: Ekstralar',
      'Fiyat genelde “Fiyata ekle” → her adet birim fiyatı ekler',
      'Mantar ₺10, Sucuk ₺15… istediğin kadar seçenek',
      'Zorunlu değilse ekstra hiç seçmeden de sipariş verilir',
    ],
    tip: 'Bu butona basarak kendi ürününde de aynı grubu ekleyebilirsin.',
    target: 'pv-add-multi',
    Icon: ListChecks,
  },
  {
    id: 'multi-max',
    title: 'Grupta genel “Maks” ne işe yarar?',
    body: 'Ekstralar satırındaki Maks, tüm boylar için ortak yedek limittir. Boyda “Ekstra 5 / 7” yazdıysan siparişte boy limiti önceliklidir; yazmadıysan bu Maks kullanılır.',
    bullets: [
      'Maks dolu + boyda limit yok → Maks geçerli',
      'Boyda Ekstra 5 yazıldı → Büyük seçilince 5',
      '∞ / 0 = sınırsız (o kaynak için)',
    ],
    tip: 'Pratikte boy limitlerini doldurup grup Maks’ı boş bırakmak da yeterli.',
    target: 'pv-groups',
    Icon: ListChecks,
  },
  {
    id: 'exclude',
    title: '“Seçilince gizle” (sade koşul)',
    body: 'Karmaşık kural motoru yok. Bir seçeneğin altında diğer seçenek chip’lerine basarsın: o seçenek seçilince işaretlediklerin sipariş ekranından kaybolur.',
    bullets: [
      'Örnek: Acılı seçilince “Çocuk porsiyonu” gizlensin',
      'Chip kırmızı/yanıyorsa kural açık',
      'Tekrar basınca kural kalkar',
      'Boy değişince veya seçim kalkınca liste yeniden ayarlanır',
    ],
    tip: 'Sadece gerçekten çakışan şeyler için kullan; her şeye kural koyma.',
    target: 'pv-groups',
    Icon: Ban,
  },
  {
    id: 'floor',
    title: 'Masada nasıl görünür?',
    body: 'Masa / sipariş ekranında ürünü sepete alınca önce boy seçilir, sonra ekstralar çıkar. Büyük seçiliyse ekstra + butonu 5’te durur; Mega’da 7’ye kadar gider.',
    bullets: [
      'Fiyat anlık güncellenir (boy + ekstralar)',
      'Gizlenen seçenekler listede görünmez',
      'Limit aşımı kayıttan da reddedilir',
    ],
    tip: 'Kurduktan sonra bir masadan denemek en net kontroldür.',
    Icon: UtensilsCrossed,
  },
  {
    id: 'save',
    title: 'Bitince Kaydet',
    body: 'Kendi ürününde işin bitince sağ üstteki Kaydet’e bas. Kaydetmeden çıkarsan değişiklikler gitmez.',
    bullets: [
      'Bu rehberdeki pizza örneği ürüne yazılmaz',
      'Rehberi kapatınca önceki ekran geri gelir',
      'Gerçek kurulumunu yaptıktan sonra mutlaka Kaydet',
    ],
    tip: 'Hazırsan Bitir’e bas. Sonra kendi ürününle aynı adımları uygula.',
    target: 'pv-save',
    Icon: Save,
  },
];

/** Rehber adımının hangi demo içeriğini göstereceği */
export function guideDemoPhase(id: GuideStepId): 'empty' | 'boy' | 'boy-limits' | 'full' | 'full-exclude' {
  switch (id) {
    case 'welcome':
    case 'pick':
    case 'idea':
      return 'empty';
    case 'single':
    case 'single-fields':
      return 'boy';
    case 'type-max':
      return 'boy-limits';
    case 'multi':
    case 'multi-max':
      return 'full';
    case 'exclude':
    case 'floor':
    case 'save':
      return 'full-exclude';
    default:
      return 'empty';
  }
}

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(selector: string | undefined): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(`[data-tour="${selector}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: Math.min(window.innerWidth - 16, r.width + pad * 2),
    height: Math.min(window.innerHeight - 16, r.height + pad * 2),
  };
}

type Props = {
  open: boolean;
  stepIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function ProductVariantsGuideOverlay({
  open,
  stepIndex,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const step = VARIANT_GUIDE_STEPS[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const update = () => setRect(measureTarget(step.target));
    update();
    const t = window.setTimeout(update, 80);
    const t2 = window.setTimeout(update, 320);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, stepIndex, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onNext, onPrev]);

  if (!open || !step) return null;

  const Icon = step.Icon;
  const isLast = stepIndex >= VARIANT_GUIDE_STEPS.length - 1;
  const isFirst = stepIndex <= 0;

  const cardStyle: CSSProperties = (() => {
    if (!rect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const cardH = 340;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const preferBelow = spaceBelow > cardH || rect.top < 180;
    const top = preferBelow
      ? Math.min(window.innerHeight - cardH - 12, rect.top + rect.height + 12)
      : Math.max(12, rect.top - cardH - 8);
    let left = rect.left;
    left = Math.min(left, window.innerWidth - 400);
    left = Math.max(12, left);
    return { position: 'fixed', top, left };
  })();

  return (
    <div className="pv-guide" role="dialog" aria-modal="true" aria-label="Varyant rehberi">
      <div className="pv-guide__dim" onClick={onClose} />
      {rect ? (
        <div
          className="pv-guide__spot"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      ) : null}

      <div className="pv-guide__card" style={cardStyle}>
        <button type="button" className="pv-guide__close" onClick={onClose} aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
        <div className="pv-guide__icon">
          <Icon className="w-6 h-6" />
        </div>
        <p className="pv-guide__step">
          Adım {stepIndex + 1} / {VARIANT_GUIDE_STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p className="pv-guide__body">{step.body}</p>
        {step.bullets?.length ? (
          <ul className="pv-guide__bullets">
            {step.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {step.tip ? <p className="pv-guide__tip">{step.tip}</p> : null}
        <div className="pv-guide__nav">
          <button type="button" className="pv-guide__btn" disabled={isFirst} onClick={onPrev}>
            <ChevronLeft className="w-4 h-4" />
            Geri
          </button>
          <button type="button" className="pv-guide__btn pv-guide__btn--primary" onClick={onNext}>
            {isLast ? 'Bitir' : 'İleri'}
            {!isLast ? <ChevronRight className="w-4 h-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
