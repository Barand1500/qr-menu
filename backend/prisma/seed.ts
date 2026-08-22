import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const languages = await Promise.all([
    prisma.language.upsert({
      where: { code: 'tr' },
      update: { isActive: true },
      create: { code: 'tr', name: 'Türkçe', isActive: true },
    }),
    prisma.language.upsert({
      where: { code: 'en' },
      update: { isActive: true },
      create: { code: 'en', name: 'English', isActive: true },
    }),
    prisma.language.upsert({
      where: { code: 'ru' },
      update: { isActive: false },
      create: { code: 'ru', name: 'Русский', isActive: false },
    }),
  ]);

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'zeen-lounge' },
    update: { name: 'Zeen Lounge' },
    create: {
      name: 'Zeen Lounge',
      slug: 'zeen-lounge',
      logoUrl: null,
    },
  });

  const passwordHash = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { email: 'admin@guzelteknoloji.com' },
    update: {
      passwordHash,
      fullName: 'Admin Kullanıcı',
      isActive: true,
    },
    create: {
      restaurantId: restaurant.id,
      email: 'admin@guzelteknoloji.com',
      passwordHash,
      fullName: 'Admin Kullanıcı',
      phone: '',
      role: 'admin',
      isActive: true,
    },
  });

  for (const lang of languages.filter((l) => l.isActive)) {
    await prisma.welcomeMessage.upsert({
      where: {
        restaurantId_languageId: {
          restaurantId: restaurant.id,
          languageId: lang.id,
        },
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        languageId: lang.id,
        message:
          lang.code === 'tr'
            ? 'Dijital menümüze hoşgeldiniz...'
            : 'Welcome to our digital menu...',
      },
    });
  }

  const sampleGroups = [
    { tr: 'KAHVALTILAR', en: 'BREAKFASTS', sortOrder: 1 },
    { tr: 'MEZELER', en: 'APPETIZERS', sortOrder: 2 },
    { tr: 'HAMBURGERLER', en: 'BURGERS', sortOrder: 3 },
    { tr: 'SALATALAR', en: 'SALADS', sortOrder: 4 },
    { tr: 'PİZZALAR', en: 'PIZZAS', sortOrder: 5 },
  ];

  for (const g of sampleGroups) {
    const existing = await prisma.groupTranslation.findFirst({
      where: {
        name: g.tr,
        group: { restaurantId: restaurant.id },
      },
    });
    if (existing) continue;

    const group = await prisma.group.create({
      data: {
        restaurantId: restaurant.id,
        sortOrder: g.sortOrder,
        isActive: true,
        translations: {
          create: [
            { languageId: languages[0].id, name: g.tr },
            { languageId: languages[1].id, name: g.en },
          ],
        },
      },
    });

    const products = [
      { tr: `${g.tr} Özel`, en: `${g.en} Special`, price: 150 + g.sortOrder * 50 },
      { tr: `${g.tr} Klasik`, en: `${g.en} Classic`, price: 120 + g.sortOrder * 40 },
    ];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      await prisma.product.create({
        data: {
          restaurantId: restaurant.id,
          groupId: group.id,
          price: p.price,
          sortOrder: i + 1,
          isActive: true,
          translations: {
            create: [
              { languageId: languages[0].id, name: p.tr },
              { languageId: languages[1].id, name: p.en },
            ],
          },
        },
      });
    }
  }

  console.log('Seed tamamlandı.');
  console.log('Giriş: admin@guzelteknoloji.com / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
