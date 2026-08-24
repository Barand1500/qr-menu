/** Örnek menü verisi — seed için hazır Türkçe içerik */

export const UNSPLASH = {
  kahvalti: 'https://images.unsplash.com/photo-1533089860890-a1c960265a9c?w=800&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
  salata: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
  tatli: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
  icecek: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  banner1: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80',
  banner2: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80',
};

export interface SeedGroup {
  sortOrder: number;
  imageUrl: string;
  i18n: Record<string, { name: string }>;
  products: SeedProduct[];
}

export interface SeedProduct {
  sortOrder: number;
  price: number;
  imageUrl: string;
  isRecommended?: boolean;
  features?: string[];
  prepTimeMinutes?: number;
  calories?: number;
  i18n: Record<
    string,
    { name: string; description?: string; ingredients?: string; allergens?: string }
  >;
}

export const SEED_GROUPS: SeedGroup[] = [
  {
    sortOrder: 1,
    imageUrl: UNSPLASH.kahvalti,
    i18n: {
      tr: { name: 'Kahvaltılar' },
      en: { name: 'Breakfasts' },
    },
    products: [
      {
        sortOrder: 1,
        price: 289.9,
        imageUrl: UNSPLASH.kahvalti,
        isRecommended: true,
        prepTimeMinutes: 20,
        calories: 680,
        features: ['Paylaşımlık'],
        i18n: {
          tr: {
            name: 'Serpme Kahvaltı',
            description: 'Peynir çeşitleri, zeytin, reçel, bal, kaymak ve sıcak tabak.',
            ingredients: 'Peynir, zeytin, yumurta, domates, salatalık',
            allergens: 'Süt, gluten',
          },
          en: {
            name: 'Turkish Breakfast Platter',
            description: 'Cheeses, olives, jams, honey, clotted cream and hot plate.',
          },
        },
      },
      {
        sortOrder: 2,
        price: 149.9,
        imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        prepTimeMinutes: 10,
        calories: 420,
        i18n: {
          tr: {
            name: 'Menemen',
            description: 'Domates, biber ve yumurtayla hazırlanan geleneksel lezzet.',
          },
          en: { name: 'Menemen', description: 'Traditional eggs with tomato and pepper.' },
        },
      },
      {
        sortOrder: 3,
        price: 89.9,
        imageUrl: 'https://images.unsplash.com/photo-1482049010928-d99510fd43a2?w=800&q=80',
        calories: 380,
        i18n: {
          tr: { name: 'Avokado Tost', description: 'Ekşi mayalı ekmek üzerinde avokado ve poşe yumurta.' },
          en: { name: 'Avocado Toast', description: 'Sourdough with avocado and poached egg.' },
        },
      },
    ],
  },
  {
    sortOrder: 2,
    imageUrl: UNSPLASH.burger,
    i18n: {
      tr: { name: 'Burgerler' },
      en: { name: 'Burgers' },
    },
    products: [
      {
        sortOrder: 1,
        price: 249.9,
        imageUrl: UNSPLASH.burger,
        isRecommended: true,
        prepTimeMinutes: 15,
        calories: 720,
        features: ['Popüler'],
        i18n: {
          tr: {
            name: 'Zeen Burger',
            description: '180g dana köfte, cheddar, karamelize soğan, özel sos.',
            ingredients: 'Dana eti, cheddar, brioche ekmek',
            allergens: 'Gluten, süt',
          },
          en: {
            name: 'Zeen Burger',
            description: '180g beef patty, cheddar, caramelized onion, house sauce.',
          },
        },
      },
      {
        sortOrder: 2,
        price: 219.9,
        imageUrl: 'https://images.unsplash.com/photo-1606755962773-d324e166a853?w=800&q=80',
        isRecommended: true,
        prepTimeMinutes: 12,
        calories: 580,
        i18n: {
          tr: {
            name: 'Tavuk Burger',
            description: 'Çıtır tavuk göğsü, marul, turşu ve sarımsaklı mayonez.',
          },
          en: { name: 'Chicken Burger', description: 'Crispy chicken breast with pickles.' },
        },
      },
      {
        sortOrder: 3,
        price: 199.9,
        imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80',
        features: ['Vegan'],
        i18n: {
          tr: { name: 'Vegan Burger', description: 'Mercimek köftesi, avokado ve taze yeşillikler.' },
          en: { name: 'Vegan Burger', description: 'Lentil patty with avocado and greens.' },
        },
      },
    ],
  },
  {
    sortOrder: 3,
    imageUrl: UNSPLASH.pizza,
    i18n: {
      tr: { name: 'Pizzalar' },
      en: { name: 'Pizzas' },
    },
    products: [
      {
        sortOrder: 1,
        price: 229.9,
        imageUrl: UNSPLASH.pizza,
        isRecommended: true,
        prepTimeMinutes: 18,
        calories: 650,
        i18n: {
          tr: {
            name: 'Margherita Pizza',
            description: 'İnce hamur, domates sos, mozzarella ve fesleğen.',
          },
          en: { name: 'Margherita Pizza', description: 'Thin crust, tomato, mozzarella, basil.' },
        },
      },
      {
        sortOrder: 2,
        price: 269.9,
        imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80',
        i18n: {
          tr: { name: 'Karışık Pizza', description: 'Sucuk, mantar, biber ve zeytin.' },
          en: { name: 'Mixed Pizza', description: 'Sausage, mushroom, pepper and olives.' },
        },
      },
    ],
  },
  {
    sortOrder: 4,
    imageUrl: UNSPLASH.salata,
    i18n: {
      tr: { name: 'Salatalar' },
      en: { name: 'Salads' },
    },
    products: [
      {
        sortOrder: 1,
        price: 179.9,
        imageUrl: UNSPLASH.salata,
        isRecommended: true,
        calories: 320,
        features: ['Hafif'],
        i18n: {
          tr: {
            name: 'Caesar Salata',
            description: 'Marul, parmesan, kruton ve Caesar sos.',
          },
          en: { name: 'Caesar Salad', description: 'Romaine, parmesan, croutons, Caesar dressing.' },
        },
      },
      {
        sortOrder: 2,
        price: 159.9,
        imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
        i18n: {
          tr: { name: 'Akdeniz Salatası', description: 'Domates, salatalık, beyaz peynir, zeytinyağı.' },
          en: { name: 'Mediterranean Salad', description: 'Tomato, cucumber, feta, olive oil.' },
        },
      },
    ],
  },
  {
    sortOrder: 5,
    imageUrl: UNSPLASH.tatli,
    i18n: {
      tr: { name: 'Tatlılar' },
      en: { name: 'Desserts' },
    },
    products: [
      {
        sortOrder: 1,
        price: 129.9,
        imageUrl: UNSPLASH.tatli,
        isRecommended: true,
        calories: 480,
        i18n: {
          tr: { name: 'Tiramisu', description: 'Mascarpone kremalı klasik İtalyan tatlısı.' },
          en: { name: 'Tiramisu', description: 'Classic Italian dessert with mascarpone.' },
        },
      },
      {
        sortOrder: 2,
        price: 99.9,
        imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        i18n: {
          tr: { name: 'Sufle', description: 'Sıcak çikolatalı sufle, vanilyalı dondurma ile.' },
          en: { name: 'Chocolate Soufflé', description: 'Warm chocolate soufflé with vanilla ice cream.' },
        },
      },
    ],
  },
  {
    sortOrder: 6,
    imageUrl: UNSPLASH.icecek,
    i18n: {
      tr: { name: 'İçecekler' },
      en: { name: 'Drinks' },
    },
    products: [
      {
        sortOrder: 1,
        price: 79.9,
        imageUrl: UNSPLASH.icecek,
        isRecommended: true,
        i18n: {
          tr: { name: 'Latte', description: 'Espresso ve buharla ısıtılmış süt.' },
          en: { name: 'Latte', description: 'Espresso with steamed milk.' },
        },
      },
      {
        sortOrder: 2,
        price: 69.9,
        imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=800&q=80',
        i18n: {
          tr: { name: 'Taze Sıkma Portakal', description: 'Günlük taze sıkılmış portakal suyu.' },
          en: { name: 'Fresh Orange Juice', description: 'Daily fresh squeezed orange juice.' },
        },
      },
    ],
  },
];

export const SEED_BANNERS = [
  {
    name: 'Yaz Lezzetleri',
    imageUrl: UNSPLASH.banner1,
    productKey: 'Burgerler:Zeen Burger',
    i18n: {
      tr: { title1: 'Yaz Lezzetleri Başladı', title2: 'En sevilen menüler burada' },
      en: { title1: 'Summer Flavors', title2: 'Most loved menus here' },
    },
  },
  {
    name: 'Şefin Önerisi',
    imageUrl: UNSPLASH.banner2,
    productKey: 'Kahvaltılar:Serpme Kahvaltı',
    i18n: {
      tr: { title1: 'Şefin Önerisi', title2: 'Bu haftanın yıldızları' },
      en: { title1: "Chef's Pick", title2: 'Stars of the week' },
    },
  },
];

export const SEED_STORIES = [
  { name: 'Burger', imageUrl: UNSPLASH.burger, productKey: 'Burgerler:Zeen Burger' },
  { name: 'Kahvaltı', imageUrl: UNSPLASH.kahvalti, productKey: 'Kahvaltılar:Serpme Kahvaltı' },
  { name: 'Pizza', imageUrl: UNSPLASH.pizza, productKey: 'Pizzalar:Margherita Pizza' },
  { name: 'Salata', imageUrl: UNSPLASH.salata, productKey: 'Salatalar:Caesar Salata' },
  { name: 'Tatlı', imageUrl: UNSPLASH.tatli, productKey: 'Tatlılar:Tiramisu' },
  { name: 'Kahve', imageUrl: UNSPLASH.icecek, productKey: 'İçecekler:Latte' },
];
