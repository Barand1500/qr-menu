import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  buildGroupI18n,
  buildProductI18n,
  getGroupName,
  getLanguages,
} from '../lib/i18n-json.js';
import { ensureDefaultCurrency } from '../lib/currencies.js';

const router = Router();
router.use(authRequired);

type AiAction =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'created'; kind: 'group' | 'product' | 'user'; id: number; label: string };

type AiResult = { reply: string; actions?: AiAction[] };

function fold(text: string) {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAGE_MAP: { keys: string[]; path: string; label: string }[] = [
  { keys: ['ozet', 'dashboard', 'ana sayfa', 'anasayfa', 'home'], path: '', label: 'Özet' },
  { keys: ['gruplar', 'grup sayfasi', 'kategoriler'], path: 'groups', label: 'Gruplar' },
  { keys: ['urunler', 'urun sayfasi', 'menu urun'], path: 'products', label: 'Ürünler' },
  { keys: ['vitrin', 'showcase', 'gorseller'], path: 'showcase', label: 'Vitrin Görselleri' },
  { keys: ['barkod'], path: 'barcode', label: 'Barkod Yazdır' },
  { keys: ['toplu ceviri', 'ceviri', 'bulk translate'], path: 'bulk-translate', label: 'Toplu Çeviri' },
  { keys: ['karsilama', 'welcome tema', 'karsilama ekrani'], path: 'startup/welcome', label: 'Karşılama Ekranı' },
  { keys: ['menu ekrani', 'menu tema'], path: 'startup/menu', label: 'Menü Ekranı' },
  { keys: ['istatistik', 'stats', 'raporlar sayfasi'], path: 'stats', label: 'İstatistikler' },
  { keys: ['oneri', 'oneri kutusu'], path: 'suggestions', label: 'Öneri Kutusu' },
  { keys: ['sikayet', 'sikayet kutusu'], path: 'complaints', label: 'Şikayet Kutusu' },
  { keys: ['kullanicilar', 'kullanici sayfasi'], path: 'users', label: 'Kullanıcılar' },
  { keys: ['ayarlar', 'settings'], path: 'settings', label: 'Ayarlar' },
  { keys: ['eklentiler', 'extensions', 'addon'], path: 'extensions', label: 'Eklentiler' },
  { keys: ['masa', 'masa gorunumu', 'salon'], path: 'masa-gorunumu', label: 'Masa Görünümü' },
  {
    keys: ['varyant', 'urun secenek', 'secenekler', 'ekstralar'],
    path: 'urun-secenekleri',
    label: 'Ürün Seçenekleri',
  },
];

function matchPage(q: string): { path: string; label: string } | null {
  for (const page of PAGE_MAP) {
    if (page.keys.some((k) => q.includes(k))) return { path: page.path, label: page.label };
  }
  return null;
}

function isGreeting(q: string) {
  return /^(selam|merhaba|hey|hello|hi|gunaydin|iyi gunler|iyi aksamlar|iyi geceler|naber|nasilsin|selamun aleykum|sa)\b/.test(
    q
  );
}

function isHelp(q: string) {
  return /^(yardim|help|ne yapabilirsin|neler yapabilirsin|komutlar|nasil kullan)/.test(q) || q === '?';
}

function isReport(q: string) {
  return /\b(rapor|ozet ver|ozet goster|istatistik|bugun ne oldu|durum nedir|genel durum)\b/.test(q);
}

async function buildReport(restaurantId: number): Promise<AiResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    groupsActive,
    groupsPassive,
    productsTotal,
    productsActive,
    usersCount,
    viewsToday,
    complaintsUnread,
    suggestionsUnread,
  ] = await Promise.all([
    prisma.group.count({ where: { restaurantId, isActive: true } }),
    prisma.group.count({ where: { restaurantId, isActive: false } }),
    prisma.product.count({ where: { restaurantId } }),
    prisma.product.count({ where: { restaurantId, isActive: true } }),
    prisma.user.count({ where: { restaurantId } }),
    prisma.viewEvent.count({ where: { restaurantId, viewedAt: { gte: today } } }),
    prisma.complaint.count({ where: { restaurantId, isRead: false } }),
    prisma.suggestion.count({ where: { restaurantId, isRead: false } }),
  ]);

  const lines = [
    'İşte güncel özet raporun:',
    `• Gruplar: ${groupsActive} aktif / ${groupsPassive} pasif`,
    `• Ürünler: ${productsActive} aktif / ${productsTotal} toplam`,
    `• Kullanıcılar: ${usersCount}`,
    `• Bugünkü menü görüntülenme: ${viewsToday}`,
  ];
  if (complaintsUnread > 0) lines.push(`• Okunmamış şikayet: ${complaintsUnread}`);
  if (suggestionsUnread > 0) lines.push(`• Okunmamış öneri: ${suggestionsUnread}`);
  lines.push('', 'Detay için İstatistikler veya ilgili sayfalara gidebilirim.');

  return {
    reply: lines.join('\n'),
    actions: [{ type: 'navigate', path: 'stats', label: 'İstatistikler' }],
  };
}

async function createGroup(restaurantId: number, name: string): Promise<AiResult> {
  const trimmed = name.replace(/^["']|["']$/g, '').trim();
  if (!trimmed || trimmed.length < 2) {
    return { reply: 'Grup adı en az 2 karakter olmalı. Örnek: `grup ekle Tatlılar`' };
  }

  const languages = await getLanguages();
  const tr = languages.find((l) => l.code === 'tr') || languages[0];
  if (!tr) return { reply: 'Dil ayarı bulunamadı; grup eklenemedi.' };

  const maxOrder = await prisma.group.aggregate({
    where: { restaurantId, parentId: null },
    _max: { sortOrder: true },
  });

  const group = await prisma.group.create({
    data: {
      restaurantId,
      parentId: null,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: true,
      i18n: buildGroupI18n([{ languageId: tr.id, name: trimmed }], languages),
    },
  });

  return {
    reply: `"${trimmed}" grubu eklendi. Gruplar sayfasına gidebilirsin.`,
    actions: [
      { type: 'created', kind: 'group', id: group.id, label: trimmed },
      { type: 'navigate', path: 'groups', label: 'Gruplar' },
    ],
  };
}

async function findGroupByName(restaurantId: number, name: string) {
  const groups = await prisma.group.findMany({ where: { restaurantId } });
  const needle = fold(name);
  return (
    groups.find((g) => fold(getGroupName(g.i18n, 'tr')) === needle) ||
    groups.find((g) => fold(getGroupName(g.i18n, 'tr')).includes(needle)) ||
    null
  );
}

async function createProduct(
  restaurantId: number,
  name: string,
  price: number,
  groupName?: string
): Promise<AiResult> {
  const trimmed = name.replace(/^["']|["']$/g, '').trim();
  if (!trimmed || trimmed.length < 2) {
    return {
      reply: 'Ürün adı eksik. Örnek: `ürün ekle Latte fiyat 120 grup Kahveler`',
    };
  }
  if (!Number.isFinite(price) || price < 0) {
    return { reply: 'Geçerli bir fiyat yaz. Örnek: `ürün ekle Latte fiyat 120`' };
  }

  let group =
    (groupName && (await findGroupByName(restaurantId, groupName))) ||
    (await prisma.group.findFirst({
      where: { restaurantId, parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }));

  if (!group) {
    return { reply: 'Önce en az bir grup eklemelisin. Örnek: `grup ekle İçecekler`' };
  }

  const [languages, currency, maxOrder] = await Promise.all([
    getLanguages(),
    ensureDefaultCurrency(),
    prisma.product.aggregate({
      where: { groupId: group.id },
      _max: { sortOrder: true },
    }),
  ]);

  const tr = languages.find((l) => l.code === 'tr') || languages[0];
  if (!tr) return { reply: 'Dil ayarı bulunamadı; ürün eklenemedi.' };

  const product = await prisma.product.create({
    data: {
      restaurantId,
      groupId: group.id,
      currencyId: currency.id,
      price,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: true,
      features: [],
      allergenTags: [],
      dietTags: [],
      i18n: buildProductI18n(
        [{ languageId: tr.id, name: trimmed, description: '' }],
        languages
      ),
    },
  });

  const gName = getGroupName(group.i18n, 'tr') || groupName || 'grup';
  return {
    reply: `"${trimmed}" ürünü ${price} ₺ ile "${gName}" grubuna eklendi.`,
    actions: [
      { type: 'created', kind: 'product', id: product.id, label: trimmed },
      { type: 'navigate', path: 'products', label: 'Ürünler' },
    ],
  };
}

async function createUser(
  restaurantId: number,
  fullName: string,
  email: string,
  password: string,
  role: 'admin' | 'staff' = 'staff'
): Promise<AiResult> {
  if (!fullName || !email || !password) {
    return {
      reply:
        'Kullanıcı için ad, e-posta ve şifre gerekli. Örnek: `kullanıcı ekle ad: Ayşe email: ayse@mail.com şifre: 123456`',
    };
  }
  if (password.length < 6) {
    return { reply: 'Şifre en az 6 karakter olmalı.' };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) return { reply: 'Bu e-posta zaten kayıtlı.' };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      restaurantId,
      email: normalizedEmail,
      passwordHash,
      fullName: fullName.trim(),
      role,
      isActive: true,
    },
  });

  return {
    reply: `${user.fullName} (${user.email}) kullanıcısı eklendi.`,
    actions: [
      { type: 'created', kind: 'user', id: user.id, label: user.fullName },
      { type: 'navigate', path: 'users', label: 'Kullanıcılar' },
    ],
  };
}

function parseCreateGroup(q: string, original: string): string | null {
  const m =
    q.match(/(?:yeni\s+)?grup\s+(?:ekle|olustur|ac)\s*[:\-]?\s*(.+)$/) ||
    q.match(/grup\s+(?:adi|ismi)\s*[:\-]?\s*(.+)$/);
  if (!m) return null;
  const start = original.length - m[1].length;
  return original.slice(Math.max(0, start)).trim() || m[1].trim();
}

function parseCreateProduct(q: string, original: string): { name: string; price: number; group?: string } | null {
  if (!/(?:yeni\s+)?urun\s+(?:ekle|olustur)/.test(q) && !/^urun\s*[:\-]/.test(q)) return null;

  const priceMatch = q.match(/fiyat\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/);
  const groupMatch = q.match(/grup\s*[:\-]?\s*(.+?)(?:\s+fiyat|$)/);
  let namePart = original
    .replace(/(?:yeni\s+)?ürün\s+(?:ekle|oluştur)/gi, '')
    .replace(/(?:yeni\s+)?urun\s+(?:ekle|olustur)/gi, '')
    .replace(/fiyat\s*[:\-]?\s*\d+(?:[.,]\d+)?/gi, '')
    .replace(/grup\s*[:\-]?\s*.+$/gi, '')
    .replace(/^[:\-\s]+/, '')
    .trim();

  if (!namePart) {
    const m = original.match(/(?:ürün|urun)\s+(?:ekle|oluştur|olustur)\s+(.+?)(?:\s+fiyat|\s+grup|$)/i);
    namePart = m?.[1]?.trim() || '';
  }

  return {
    name: namePart,
    price: priceMatch ? Number(priceMatch[1].replace(',', '.')) : NaN,
    group: groupMatch?.[1]?.trim(),
  };
}

function parseCreateUser(q: string, original: string): {
  fullName: string;
  email: string;
  password: string;
  role: 'admin' | 'staff';
} | null {
  if (!/(?:yeni\s+)?kullanici\s+(?:ekle|olustur)/.test(q)) return null;

  const pick = (keys: string[]) => {
    for (const key of keys) {
      const re = new RegExp(`${key}\\s*[:\\-]?\\s*([^\\s]+(?:\\s+[^\\s]+)*?)(?=\\s+(?:ad|isim|email|eposta|sifre|role|rol)\\b|$)`, 'i');
      const m = original.match(re);
      if (m) return m[1].trim();
    }
    return '';
  };

  const fullName = pick(['ad soyad', 'ad', 'isim', 'name']);
  const email = pick(['email', 'e-posta', 'eposta', 'mail']);
  const password = pick(['şifre', 'sifre', 'password', 'parola']);
  const roleRaw = fold(pick(['rol', 'role']));
  const role = roleRaw.includes('admin') || roleRaw.includes('yonetici') ? 'admin' : 'staff';

  return { fullName, email, password, role };
}

function helpReply(): AiResult {
  return {
    reply: [
      'Merhaba! Ben panel asistanınım. Büyük/küçük harf fark etmez.',
      '',
      'Yapabileceklerim:',
      '• Sayfa aç: `ürünler`, `gruplar`, `kullanıcılar`, `masa görünümü`…',
      '• Grup ekle: `grup ekle Tatlılar`',
      '• Ürün ekle: `ürün ekle Latte fiyat 120 grup Kahveler`',
      '• Kullanıcı ekle: `kullanıcı ekle ad: Ali email: ali@mail.com şifre: 123456`',
      '• Rapor: `rapor` veya `özet ver`',
      '• Selamlaş: `merhaba`, `selam`',
      '',
      'Bu sohbet kapanınca sıfırlanır; geçmiş tutulmaz.',
    ].join('\n'),
  };
}

async function tryOpenAI(
  restaurantId: number,
  message: string,
  apiKey: string
): Promise<AiResult | null> {
  const pages = PAGE_MAP.map((p) => `${p.label} → ${p.path || '(özet)'}`).join(', ');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sen bir restoran QR menü admin paneli asistanısın. Türkçe, samimi ve kısa yanıt ver.
Kullanıcıya yalnızca şu aksiyonları önerebilirsin (JSON):
{"reply":"...","action":null|{"type":"navigate","path":"...","label":"..."}|{"type":"create_group","name":"..."}|{"type":"create_product","name":"...","price":number,"groupName":"..."}|{"type":"create_user","fullName":"...","email":"...","password":"...","role":"staff"|"admin"}|{"type":"report"}}
Sayfa yolları: ${pages}
Aksiyon yoksa action null. Selamlaşmalara sıcak cevap ver. Bilmediğin şeylerde yardım öner.`,
        },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  let parsed: {
    reply?: string;
    action?: {
      type?: string;
      path?: string;
      label?: string;
      name?: string;
      price?: number;
      groupName?: string;
      fullName?: string;
      email?: string;
      password?: string;
      role?: string;
    } | null;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const reply = String(parsed.reply || '').trim() || 'Tamam.';
  const action = parsed.action;
  if (!action?.type) return { reply };

  if (action.type === 'navigate' && typeof action.path === 'string') {
    const known = PAGE_MAP.find((p) => p.path === action.path) || PAGE_MAP.find((p) => !action.path && !p.path);
    return {
      reply,
      actions: [
        {
          type: 'navigate',
          path: action.path,
          label: action.label || known?.label || 'Sayfa',
        },
      ],
    };
  }
  if (action.type === 'create_group' && action.name) {
    const created = await createGroup(restaurantId, action.name);
    return { reply: created.reply || reply, actions: created.actions };
  }
  if (action.type === 'create_product' && action.name) {
    const created = await createProduct(
      restaurantId,
      action.name,
      Number(action.price),
      action.groupName
    );
    return { reply: created.reply || reply, actions: created.actions };
  }
  if (action.type === 'create_user' && action.fullName && action.email && action.password) {
    const role = action.role === 'admin' ? 'admin' : 'staff';
    const created = await createUser(
      restaurantId,
      action.fullName,
      action.email,
      action.password,
      role
    );
    return { reply: created.reply || reply, actions: created.actions };
  }
  if (action.type === 'report') {
    const report = await buildReport(restaurantId);
    return { reply: report.reply, actions: report.actions };
  }

  return { reply };
}

router.post('/chat', async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req);
    if (!restaurantId) return res.status(401).json({ message: 'Yetkisiz' });

    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Mesaj gerekli' });
    if (message.length > 2000) return res.status(400).json({ message: 'Mesaj çok uzun' });

    const q = fold(message);

    if (isGreeting(q)) {
      return res.json({
        reply:
          'Merhaba! Yardımcı olayım — sayfa açabilir, ürün/grup/kullanıcı ekleyebilir veya kısa rapor verebilirim. Ne yapmak istersin?',
      } satisfies AiResult);
    }

    if (isHelp(q)) {
      return res.json(helpReply());
    }

    if (isReport(q)) {
      return res.json(await buildReport(restaurantId));
    }

    const groupName = parseCreateGroup(q, message);
    if (groupName != null) {
      return res.json(await createGroup(restaurantId, groupName));
    }

    const productParsed = parseCreateProduct(q, message);
    if (productParsed) {
      return res.json(
        await createProduct(restaurantId, productParsed.name, productParsed.price, productParsed.group)
      );
    }

    const userParsed = parseCreateUser(q, message);
    if (userParsed) {
      return res.json(
        await createUser(
          restaurantId,
          userParsed.fullName,
          userParsed.email,
          userParsed.password,
          userParsed.role
        )
      );
    }

    const navIntent =
      /\b(ac|git|goster|acikla|sayfasina|sayfaya|beni)\b/.test(q) ||
      PAGE_MAP.some((p) => p.keys.some((k) => q === k || q.startsWith(k + ' ')));
    const page = matchPage(q);
    if (page && (navIntent || q.length < 40)) {
      return res.json({
        reply: `${page.label} sayfasına yönlendiriyorum.`,
        actions: [{ type: 'navigate', path: page.path, label: page.label }],
      } satisfies AiResult);
    }

    const keyRow = await prisma.setting.findUnique({
      where: { restaurantId_key: { restaurantId, key: 'openai_api_key' } },
    });
    if (keyRow?.value) {
      try {
        const smart = await tryOpenAI(restaurantId, message, keyRow.value);
        if (smart) return res.json(smart);
      } catch {
        /* fallback below */
      }
    }

    if (page) {
      return res.json({
        reply: `${page.label} sayfasını mı demek istedin? Oraya gidebilirim.`,
        actions: [{ type: 'navigate', path: page.path, label: page.label }],
      } satisfies AiResult);
    }

    return res.json({
      reply:
        'Anlamadım. `yardım` yazarak komutları görebilirsin. Örnek: `ürünler`, `grup ekle Tatlılar`, `rapor`.',
    } satisfies AiResult);
  } catch (err) {
    console.error('[ai-assistant]', err);
    res.status(500).json({ message: 'Asistan yanıt veremedi' });
  }
});

export default router;
