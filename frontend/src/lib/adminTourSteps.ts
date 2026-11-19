import { adminPath } from '@/lib/adminPath';

export type TourOpenGroup = 'startup' | 'reports' | 'management';

/** Tur sırasında oluşturulan kayıtlar; tur bitince silinir. */
export type TourCreated = { group?: number; product?: number; user?: number };

export type TourCtx = {
  created: TourCreated;
  /** Önceki adımda bulunan pencere; yeni bir pencere beklenirken eskisini atlamak için. */
  prev: Element | null;
};

export type TourWait =
  /** Vurgulanan öğeye tıklanınca ilerler. */
  | { click: true }
  /** "METOD /yol" başarılı bir istek görülünce ilerler (örn. 'POST /api/admin/groups'). */
  | { api: string };

export type TourStep = {
  id: string;
  title: string;
  body: string;
  path?: string;
  openGroup?: TourOpenGroup;
  /** Vurgulanacak öğe (data-tour değeri). */
  target?: string;
  /** target yerine kullanılır: sayfada öğeyi kendisi bulur. */
  find?: (ctx: TourCtx) => HTMLElement | null;
  /**
   * spot: sayfada karartma + vurgu (driver.js).
   * coach: açık pencerenin içinde küçük yönlendirme kartı (modal üstte olduğu için karartma kullanılamaz).
   */
  mode?: 'spot' | 'coach';
  /** Kısa eylem çağrısı (mor şerit). */
  task?: string;
  wait?: TourWait;
  /** coach modunda pencere içinde nabız atacak düğmenin yazısı. */
  glow?: RegExp;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
};

const byText = (selector: string, re: RegExp, root: ParentNode = document) =>
  (Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
    (el) => re.test((el.textContent || '').trim()) && el.getBoundingClientRect().width > 1,
  ) ?? null);

/** Açık (ve varsa "yeni") modal pencere. */
const openDialog = (ctx: TourCtx, selector = 'dialog[open], [role="dialog"]') => {
  const list = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return list.reverse().find((el) => el !== ctx.prev) ?? null;
};

export function getAdminTourSteps(): TourStep[] {
  return [
    {
      id: 'welcome',
      title: 'Birlikte deneyelim',
      body: 'Şimdi menüye gerçekten bir grup, bir ürün ve bir çalışan ekleyeceğiz; ürünü gruba da atayacağız. Bitirince denemelerin hepsi kendiliğinden silinir.',
      placement: 'center',
    },

    // ── Grup ekle
    {
      id: 'group-add',
      title: 'Önce bir grup',
      body: 'Gruplar menünün başlıklarıdır: Burgerler, İçecekler…',
      path: adminPath('groups'),
      find: () => byText('.ag-head button', /grup ekle/i),
      task: 'Grup ekle’ye dokun',
      wait: { click: true },
      placement: 'bottom',
    },
    {
      id: 'group-form',
      title: 'Adını yaz',
      body: 'Örneğin “Deneme Grubu” yaz ve kaydet.',
      mode: 'coach',
      find: (ctx) => openDialog(ctx, 'dialog[open]'),
      wait: { api: 'POST /api/admin/groups' },
    },

    // ── Ürün ekle
    {
      id: 'product-add',
      title: 'Şimdi bir ürün',
      body: 'Ürünler fotoğraf, fiyat ve açıklamayla menüde görünür.',
      path: adminPath('products'),
      find: () => byText('.ap-head__actions button', /ürün ekle/i),
      task: 'Ürün ekle’ye dokun',
      wait: { click: true },
      placement: 'bottom',
    },
    {
      id: 'product-form',
      title: 'Ad ve fiyat yeter',
      body: 'Ürüne bir ad ve fiyat ver, herhangi bir grup seç ve kaydet.',
      mode: 'coach',
      find: (ctx) => openDialog(ctx, '[role="dialog"]'),
      wait: { api: 'POST /api/admin/products' },
    },

    // ── Ürünü gruba ata
    {
      id: 'group-more',
      title: 'Ürünü gruba atayalım',
      body: 'Açtığın grubun işlemlerine gir.',
      path: adminPath('groups'),
      find: (ctx) =>
        document.querySelector<HTMLElement>(`.ag-row[data-group-id="${ctx.created.group}"] .ag-more`) ??
        document.querySelector<HTMLElement>('.ag-row .ag-more'),
      task: 'Üç noktaya dokun',
      wait: { click: true },
      placement: 'left',
    },
    {
      id: 'group-assign-menu',
      title: 'Ürün ata',
      body: 'Mevcut ürünleri gruba toplu eklemek için bunu seç.',
      mode: 'coach',
      find: (ctx) => openDialog(ctx, 'dialog[open]'),
      glow: /ürün ata/i,
      wait: { click: true },
    },
    {
      id: 'group-assign',
      title: 'Ürünü seç',
      body: 'Yalnızca az önce eklediğin ürünü işaretle ve gruba ekle.',
      mode: 'coach',
      find: (ctx) => openDialog(ctx, 'dialog[open]'),
      wait: { api: 'POST /api/admin/products/move-to-group' },
    },

    // ── Çalışan ekle
    {
      id: 'user-add',
      title: 'Çalışan ekleyelim',
      body: 'Her çalışan kendi hesabıyla girer; yetkisini siz belirlersiniz.',
      path: adminPath('users'),
      find: () => byText('button', /kullanıcı ekle/i),
      task: 'Kullanıcı ekle’ye dokun',
      wait: { click: true },
      placement: 'bottom',
    },
    {
      id: 'user-form',
      title: 'Bilgilerini yaz',
      body: 'Ad, e-posta ve şifre gir (örn. deneme@ornek.com), rolü seç ve kaydet.',
      mode: 'coach',
      find: (ctx) => openDialog(ctx, '[role="dialog"]'),
      wait: { api: 'POST /api/admin/users' },
    },

    // ── Bitiş
    {
      id: 'menu-preview',
      title: 'Sonucu gör',
      body: 'Müşterinin telefonunda gördüğü menü burada. Yeni grup ve ürününü orada bulabilirsin.',
      path: adminPath(),
      target: 'menu-preview',
      placement: 'right',
    },
    {
      id: 'done',
      title: 'Hazırsın!',
      body: 'Bitir’e basınca tur sırasında eklediğin grup, ürün ve çalışan silinir; menün eskisi gibi kalır.',
      placement: 'center',
    },
  ];
}
