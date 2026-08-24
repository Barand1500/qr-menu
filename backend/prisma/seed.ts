import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { SEED_BANNERS, SEED_GROUPS, SEED_STORIES } from './seed-data.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Veritabanı temizleniyor...');
  await prisma.viewEvent.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.showcaseImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.group.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.language.deleteMany();
  await prisma.currency.deleteMany();

  const languages = await Promise.all([
    prisma.language.create({ data: { code: 'tr', name: 'Türkçe', isActive: true } }),
    prisma.language.create({ data: { code: 'en', name: 'English', isActive: true } }),
    prisma.language.create({ data: { code: 'ru', name: 'Русский', isActive: false } }),
  ]);

  const tryCurrency = await prisma.currency.create({
    data: { code: 'TRY', name: 'Türk Lirası', symbol: '₺', isActive: true },
  });
  await prisma.currency.create({
    data: { code: 'USD', name: 'ABD Doları', symbol: '$', isActive: true },
  });
  await prisma.currency.create({
    data: { code: 'EUR', name: 'Euro', symbol: '€', isActive: false },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Zeen Lounge',
      slug: 'zeen-lounge',
      logoUrl: null,
      welcomeI18n: {
        tr: { message: 'Dijital menümüze hoş geldiniz. Afiyet olsun!' },
        en: { message: 'Welcome to our digital menu. Enjoy!' },
      },
    },
  });

  const passwordHash = await bcrypt.hash('123456', 10);
  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      email: 'admin@guzelteknoloji.com',
      passwordHash,
      fullName: 'Admin Kullanıcı',
      phone: '0555 000 00 00',
      role: 'admin',
      isActive: true,
    },
  });

  await prisma.setting.create({
    data: {
      restaurantId: restaurant.id,
      key: 'company_about',
      value:
        'Zeen Lounge, İstanbul\'un kalbinde modern Türk ve dünya mutfağını bir araya getiren samimi bir mekândır. Taze malzemeler, özenli sunum ve sıcak atmosfer bizim için her şeyden önemlidir.',
    },
  });

  await prisma.setting.create({
    data: {
      restaurantId: restaurant.id,
      key: 'welcome_music_url',
      value:
        'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749913b.mp3?filename=ambient-background-339801.mp3',
    },
  });

  const productMap = new Map<string, number>();

  for (const g of SEED_GROUPS) {
    const group = await prisma.group.create({
      data: {
        restaurantId: restaurant.id,
        sortOrder: g.sortOrder,
        imageUrl: g.imageUrl,
        isActive: true,
        i18n: g.i18n,
      },
    });

    for (const p of g.products) {
      const product = await prisma.product.create({
        data: {
          restaurantId: restaurant.id,
          groupId: group.id,
          price: p.price,
          currencyId: tryCurrency.id,
          sortOrder: p.sortOrder,
          imageUrl: p.imageUrl,
          images: p.imageUrl ? [p.imageUrl] : [],
          isActive: true,
          isRecommended: p.isRecommended ?? false,
          prepTimeMinutes: p.prepTimeMinutes ?? null,
          calories: p.calories ?? null,
          features: p.features ?? [],
          i18n: p.i18n,
        },
      });

      const trName = p.i18n.tr?.name || Object.values(p.i18n)[0]?.name;
      const groupName = g.i18n.tr?.name || Object.values(g.i18n)[0]?.name;
      if (trName && groupName) {
        productMap.set(`${groupName}:${trName}`, product.id);
      }
    }
  }

  for (let i = 0; i < SEED_BANNERS.length; i++) {
    const b = SEED_BANNERS[i];
    await prisma.showcaseImage.create({
      data: {
        restaurantId: restaurant.id,
        name: b.name,
        imageUrl: b.imageUrl,
        displayType: 'banner',
        sortOrder: i + 1,
        isActive: true,
        productId: productMap.get(b.productKey) ?? null,
        i18n: b.i18n,
      },
    });
  }

  for (let i = 0; i < SEED_STORIES.length; i++) {
    const s = SEED_STORIES[i];
    await prisma.showcaseImage.create({
      data: {
        restaurantId: restaurant.id,
        name: s.name,
        imageUrl: s.imageUrl,
        displayType: 'story',
        sortOrder: i + 1,
        isActive: true,
        durationSeconds: 5,
        productId: productMap.get(s.productKey) ?? null,
        i18n: {},
      },
    });
  }

  const sampleProductIds = [...productMap.values()].slice(0, 5);
  for (let i = 0; i < sampleProductIds.length; i++) {
    await prisma.viewEvent.create({
      data: {
        restaurantId: restaurant.id,
        entityType: 'product',
        entityId: sampleProductIds[i],
        sessionId: `seed-session-${i + 1}`,
      },
    });
  }

  console.log('');
  console.log('Seed tamamlandı!');
  console.log(`  Restoran: ${restaurant.name}`);
  console.log('  Admin: /admin');
  console.log('  Menü: /menu');
  console.log(`  Gruplar: ${SEED_GROUPS.length}`);
  console.log(
    `  Ürünler: ${SEED_GROUPS.reduce((n, g) => n + g.products.length, 0)}`
  );
  console.log(`  Vitrin: ${SEED_BANNERS.length} banner, ${SEED_STORIES.length} hikaye`);
  console.log(`  Diller: ${languages.filter((l) => l.isActive).map((l) => l.name).join(', ')}`);
  console.log('  Para birimleri: TRY, USD (aktif), EUR (pasif)');
  console.log('');
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
