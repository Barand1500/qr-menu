import { Router } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authRequired);

const MYMEMORY_LANG: Record<string, string> = {
  tr: 'tr',
  en: 'en',
  ru: 'ru',
  de: 'de',
  fr: 'fr',
  ar: 'ar',
};

const LANG_NAMES: Record<string, string> = {
  tr: 'Turkish',
  en: 'English',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
  ar: 'Arabic',
};

function normalizeLang(code: string, map: Record<string, string>) {
  const base = code.toLowerCase().split('-')[0];
  return map[base] || map[code] || code;
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanTranslation(text: string) {
  let cleaned = decodeHtml(text.trim());
  cleaned = cleaned.replace(/MYMEMORY WARNING:.+$/im, '').trim();
  cleaned = cleaned.replace(/^NEXT AVAILABLE IN \d+ SEC\.?$/i, '').trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function isQuotaOrError(text: string) {
  return /MYMEMORY WARNING|QUOTA|NEXT AVAILABLE|INVALID|AUTO-SYNC/i.test(text);
}

async function translateWithOpenAI(
  text: string,
  source: string,
  target: string,
  apiKey: string
) {
  const sourceName = LANG_NAMES[source] || source;
  const targetName = LANG_NAMES[target] || target;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You translate restaurant menu and hospitality texts. Preserve tone and meaning. Return only the translation without quotes or explanations.',
        },
        {
          role: 'user',
          content: `Translate from ${sourceName} to ${targetName}:\n\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI yanıt vermedi');
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) {
    throw new Error('OpenAI çeviri alınamadı');
  }

  return cleanTranslation(translated);
}

async function translateWithMyMemory(text: string, source: string, target: string) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${source}|${target}`);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('MyMemory yanıt vermedi');
  }

  const data = (await response.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };

  const raw = data.responseData?.translatedText?.trim();
  if (!raw || data.responseStatus !== 200 || isQuotaOrError(raw)) {
    throw new Error('MyMemory çeviri alınamadı');
  }

  return cleanTranslation(raw);
}

async function translateWithLibre(text: string, source: string, target: string) {
  const response = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: 'text',
    }),
  });

  if (!response.ok) {
    throw new Error('LibreTranslate yanıt vermedi');
  }

  const data = (await response.json()) as { translatedText?: string };
  const translated = data.translatedText?.trim();
  if (!translated) {
    throw new Error('LibreTranslate çeviri alınamadı');
  }

  return cleanTranslation(translated);
}

async function translateSegment(
  text: string,
  source: string,
  target: string,
  openaiKey?: string | null
) {
  if (!text.trim()) return text;

  if (openaiKey) {
    try {
      return await translateWithOpenAI(text, source, target, openaiKey);
    } catch {
      /* fallback */
    }
  }

  try {
    return await translateWithMyMemory(text, source, target);
  } catch {
    return translateWithLibre(text, source, target);
  }
}

async function translateText(
  text: string,
  source: string,
  target: string,
  openaiKey?: string | null
) {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (trimmed.includes('\n')) {
    const lines = text.split('\n');
    const translated = await Promise.all(
      lines.map(async (line) => {
        if (!line.trim()) return line;
        return translateSegment(line.trim(), source, target, openaiKey);
      })
    );
    return translated.join('\n');
  }

  if (trimmed.includes(',') && trimmed.split(',').length > 1) {
    const parts = trimmed.split(',');
    const translated = await Promise.all(
      parts.map(async (part) => {
        const piece = part.trim();
        if (!piece) return part;
        return translateSegment(piece, source, target, openaiKey);
      })
    );
    return translated.join(', ');
  }

  return translateSegment(trimmed, source, target, openaiKey);
}

router.post('/', async (req, res) => {
  const { text, from = 'tr', to = 'en' } = req.body as {
    text?: string;
    from?: string;
    to?: string;
  };

  const sourceBase = from.toLowerCase().split('-')[0];
  const targetBase = to.toLowerCase().split('-')[0];
  const myMemorySource = normalizeLang(from, MYMEMORY_LANG);
  const myMemoryTarget = normalizeLang(to, MYMEMORY_LANG);

  if (!text?.trim()) {
    return res.status(400).json({ message: 'Çevrilecek metin gerekli' });
  }

  if (sourceBase === targetBase) {
    return res.json({ text: text.trim() });
  }

  try {
    const restaurantId = await getRestaurantId(req);
    const openaiSetting = restaurantId
      ? await prisma.setting.findUnique({
          where: {
            restaurantId_key: { restaurantId, key: 'openai_api_key' },
          },
        })
      : null;

    const translated = await translateText(
      text,
      myMemorySource,
      myMemoryTarget,
      openaiSetting?.value
    );

    if (!translated) {
      return res.status(502).json({ message: 'Çeviri alınamadı' });
    }
    res.json({ text: translated });
  } catch {
    res.status(502).json({ message: 'Çeviri servisine ulaşılamadı' });
  }
});

export default router;
