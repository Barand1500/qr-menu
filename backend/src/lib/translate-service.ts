const MYMEMORY_LANG: Record<string, string> = {
  tr: 'tr',
  en: 'en',
  ru: 'ru',
  de: 'de',
  fr: 'fr',
  ar: 'ar',
  es: 'es',
  it: 'it',
  nl: 'nl',
  pt: 'pt',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  fa: 'fa',
  uk: 'uk',
  pl: 'pl',
  ro: 'ro',
  bg: 'bg',
  el: 'el',
  he: 'he',
  hi: 'hi',
  th: 'th',
  vi: 'vi',
  sv: 'sv',
  no: 'no',
  da: 'da',
  fi: 'fi',
  cs: 'cs',
  hu: 'hu',
};

const LANG_NAMES: Record<string, string> = {
  tr: 'Turkish',
  en: 'English',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
  ar: 'Arabic',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  fa: 'Persian',
  az: 'Azerbaijani',
  ka: 'Georgian',
  uk: 'Ukrainian',
  pl: 'Polish',
  ro: 'Romanian',
  bg: 'Bulgarian',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  cs: 'Czech',
  hu: 'Hungarian',
  sr: 'Serbian',
  hr: 'Croatian',
  sq: 'Albanian',
};

export function normalizeMyMemoryLang(code: string) {
  const base = code.toLowerCase().split('-')[0];
  return MYMEMORY_LANG[base] || MYMEMORY_LANG[code] || code;
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

export async function translateText(
  text: string,
  source: string,
  target: string,
  openaiKey?: string | null
) {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const sourceNorm = normalizeMyMemoryLang(source);
  const targetNorm = normalizeMyMemoryLang(target);
  const sourceBase = source.toLowerCase().split('-')[0];
  const targetBase = target.toLowerCase().split('-')[0];
  if (sourceBase === targetBase) return trimmed;

  if (trimmed.includes('\n')) {
    const lines = text.split('\n');
    const translated = await Promise.all(
      lines.map(async (line) => {
        if (!line.trim()) return line;
        return translateSegment(line.trim(), sourceNorm, targetNorm, openaiKey);
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
        return translateSegment(piece, sourceNorm, targetNorm, openaiKey);
      })
    );
    return translated.join(', ');
  }

  return translateSegment(trimmed, sourceNorm, targetNorm, openaiKey);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
