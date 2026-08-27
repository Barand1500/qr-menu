/** Karşılama müziği URL çözümleme */

export function extractYoutubeId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith('/embed/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i
  );
  return m?.[1] ?? null;
}

export function isSpotifyUrl(url: string): boolean {
  return /spotify\.com|open\.spotify/i.test(url.trim());
}

export function youtubeEmbedSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    loop: '1',
    playlist: videoId,
    controls: '0',
    disablekb: '1',
    fs: '0',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    enablejsapi: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

const FALLBACK_TRACKS = [
  'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749913b.mp3?filename=ambient-background-339801.mp3',
  'https://cdn.pixabay.com/download/audio/2022/03/24/audio_c8c8a73467.mp3?filename=lofi-study-112191.mp3',
];

export type WelcomeMusicKind = 'youtube' | 'audio' | 'fallback';

export function resolveWelcomeMusic(custom?: string | null): {
  kind: WelcomeMusicKind;
  youtubeId?: string;
  audioSources: string[];
} {
  const trimmed = custom?.trim() || '';
  if (!trimmed) {
    return { kind: 'fallback', audioSources: FALLBACK_TRACKS };
  }
  const yt = extractYoutubeId(trimmed);
  if (yt) {
    return { kind: 'youtube', youtubeId: yt, audioSources: [] };
  }
  if (isSpotifyUrl(trimmed)) {
    return { kind: 'fallback', audioSources: FALLBACK_TRACKS };
  }
  return { kind: 'audio', audioSources: [trimmed, ...FALLBACK_TRACKS] };
}
