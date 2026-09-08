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
  TextCursorInput,
  Copy,
  ClipboardPaste,
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
  | 'choice'
  | 'exclude'
  | 'copy'
  | 'paste'
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
      'Tek seçim → boy, tür, porsiyon',
      'Ekstra + miktar → mantar ×2 gibi adetli ekler',
      'Çoklu seçim → “maydanoz olmasın” gibi düz yazı istekler',
      'Kopyala / yapıştır → bir üründen diğerine seçenek aktar',
    ],
    tip: 'Şimdi pizza + istek örneğiyle adım adım gideceğiz. Örnek kaydedilmez; bitince ekran eski haline döner.',
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
    body: 'Diyelim ki pizza satıyorsun. Müşteri önce boy seçsin, sonra ekstra eklesin, bir de “maydanoz olmasın” gibi istekleri işaretlesin.',
    bullets: [
      '1) Boy (tek seçim): Büyük / Mega + ekstra limiti',
      '2) Ekstralar (miktar): Mantar, Sucuk…',
      '3) İstekler (çoklu seçim): Maydanoz olmasın, Ketçap olmasın…',
      '4) İstersen Acılı seçilince başka seçenek gizlensin',
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
      'Tek seçim / Çoklu + miktar / Çoklu seçim → grup tipi',
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
    tip: 'Limit sadece “Ekstra + miktar” gruplarına uygulanır; istek (çoklu seçim) sayılmaz.',
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
    id: 'choice',
    title: 'Çoklu seçim (düz yazı istekler)',
    body: '“Çoklu seçim” döner / burger için “maydanoz olmasın”, “ketçap olmasın” gibi işaretlenebilir isteklerdir. Adet yok; chip’e basınca aç/kapa olur. Yanına fiyat koyabilirsin (çoğu zaman 0).',
    bullets: [
      'Grup adı örnekte: İstekler',
      'Her satır düz yazı + isteğe bağlı fiyat',
      'Birden fazla istek aynı anda seçilebilir',
      'İleride online siparişte de aynı yapı kullanılır',
    ],
    tip: 'Ekstra (miktar) ile karıştırma: ekstra = adetli malzeme; çoklu seçim = işaretli istek.',
    target: 'pv-add-choice',
    Icon: TextCursorInput,
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
    id: 'copy',
    title: 'Seçenekleri kopyala',
    body: 'Soldaki listede her ürünün yanında kopyala ikonu var. Seçenekli bir üründe buna basınca sağdaki gruplar ikona doğru “emilerek” kopyalanır.',
    bullets: [
      'Önce seçenekleri olan ürünü bul',
      'Soldaki kopyala ikonuna bas',
      'Üstte “Kopya: …” yazısı çıkar',
      'Aynı ikona tekrar basarsan kopya iptal olur',
    ],
    tip: 'Kaydedilmemiş düzenlemeyi kopyalarken o ürün seçiliyse ekrandaki (henüz kaydedilmemiş) hâli alınır.',
    target: 'pv-list',
    Icon: Copy,
  },
  {
    id: 'paste',
    title: 'Başka ürüne yapıştır',
    body: 'Kopyadan sonra diğer ürünlerde yapıştır ikonu yanıp söner. Tıklayınca seçenekler o ürüne yazılır; kartlar ikondan çıkıp yerlerine oturur.',
    bullets: [
      'Hedef üründe zaten seçenek varsa üzerine yazma onayı istenir',
      'Yapıştırınca otomatik kaydedilir (hemen API’ye gider)',
      'Hedef ürün sağda açılır, sonucu görürsün',
      'Üstteki X ile kopyayı temizleyebilirsin',
    ],
    tip: 'Aynı pizzayı birkaç ürüne kopyalamak için bir kez kopyala, sırayla yapıştır.',
    target: 'pv-list',
    Icon: ClipboardPaste,
  },
  {
    id: 'floor',
    title: 'Masada nasıl görünür?',
    body: 'Masa / sipariş ekranında ürünü sepete alınca önce boy, sonra istek chip’leri, sonra ekstralar çıkar. Büyük seçiliyse ekstra + butonu 5’te durur; Mega’da 7’ye kadar gider.',
    bullets: [
      'Fiyat anlık güncellenir',
      'Gizlenen seçenekler listede görünmez',
      'İstekler chip ile aç/kapa; ekstralar adetli',
      'Limit aşımı kayıttan da reddedilir',
    ],
    tip: 'Kurduktan sonra bir masadan denemek en net kontroldür.',
    Icon: UtensilsCrossed,
  },
  {
    id: 'save',
    title: 'Bitince Kaydet',
    body: 'Kendi ürününde elle kurduğun seçeneklerde işin bitince sağ üstteki Kaydet’e bas. (Yapıştır işlemi zaten kaydeder.)',
    bullets: [
      'Bu rehberdeki örnek ürüne yazılmaz',
      'Rehberi kapatınca önceki ekran geri gelir',
      'Elle düzenlediysen mutlaka Kaydet',
    ],
    tip: 'Hazırsan Bitir’e bas. Sonra kendi ürününle aynı adımları uygula.',
    target: 'pv-save',
    Icon: Save,
  },
];

/** Rehber adımının hangi demo içeriğini göstereceği */
export function guideDemoPhase(
  id: GuideStepId
): 'empty' | 'boy' | 'boy-limits' | 'full' | 'full-choice' | 'full-all' {
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
    case 'choice':
      return 'full-choice';
    case 'exclude':
    case 'copy':
    case 'paste':
    case 'floor':
    case 'save':
      return 'full-all';
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

function isCompactViewport() {
  return typeof window !== 'undefined' && window.innerWidth < 760;
}

function placeCard(rect: Rect | null): CSSProperties {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(400, vw - margin * 2);
  const maxH = Math.min(Math.floor(vh * 0.58), 440);

  // Mobil / dar ekran: alt sheet — her zaman sığar
  if (isCompactViewport() || !rect) {
    if (isCompactViewport()) {
      return {
        position: 'fixed',
        left: margin,
        right: margin,
        bottom: margin,
        top: 'auto',
        width: 'auto',
        maxHeight: `min(58dvh, ${maxH}px)`,
        transform: 'none',
      };
    }
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardW,
      maxHeight: `min(70dvh, ${maxH}px)`,
    };
  }

  // Spot çok yüksekse (ürün listesi) kartı sağ-alta sabitle — taşma olmaz
  if (rect.height > vh * 0.32) {
    return {
      position: 'fixed',
      right: margin,
      bottom: margin,
      left: 'auto',
      top: 'auto',
      width: cardW,
      maxHeight: `min(58dvh, ${maxH}px)`,
      transform: 'none',
    };
  }

  const spaceBelow = vh - (rect.top + rect.height) - margin;
  const spaceAbove = rect.top - margin;
  const preferBelow = spaceBelow >= Math.min(280, maxH) || spaceBelow >= spaceAbove;

  let top = preferBelow ? rect.top + rect.height + 10 : rect.top - maxH - 10;
  top = Math.max(margin, Math.min(top, vh - maxH - margin));

  let left = rect.left;
  left = Math.max(margin, Math.min(left, vw - cardW - margin));

  return {
    position: 'fixed',
    top,
    left,
    width: cardW,
    maxHeight: `min(58dvh, ${maxH}px)`,
    transform: 'none',
  };
}

function clampSpot(rect: Rect): Rect {
  const vh = window.innerHeight;
  const maxH = Math.min(rect.height, Math.floor(vh * 0.38));
  return { ...rect, height: maxH };
}

export function ProductVariantsGuideOverlay({
  open,
  stepIndex,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const step = VARIANT_GUIDE_STEPS[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const update = () => {
      setCompact(isCompactViewport());
      setRect(measureTarget(step.target));
    };
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
  const spot = rect && !compact ? clampSpot(rect) : compact ? null : rect;
  const cardStyle = placeCard(rect);

  return (
    <div className="pv-guide" role="dialog" aria-modal="true" aria-label="Varyant rehberi">
      <div className="pv-guide__dim" onClick={onClose} />
      {spot ? (
        <div
          className="pv-guide__spot"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : null}

      <div
        className={`pv-guide__card${compact ? ' is-sheet' : ''}`}
        style={cardStyle}
      >
        <button type="button" className="pv-guide__close" onClick={onClose} aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
        <div className="pv-guide__scroll">
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
        </div>
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
