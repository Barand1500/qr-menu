import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Link2, Settings2, Trash2, X } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { Button } from '@/components/ui';
import type { MemoryPair, MemoryPairCount, MenuGamesConfig } from '@/lib/menuGamesConfig';

type Props = {
  open: boolean;
  config: MenuGamesConfig;
  saving?: boolean;
  onClose: () => void;
  onSave: (next: MenuGamesConfig) => Promise<void>;
};

function newId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function MemoryGameSettingsModal({
  open,
  config,
  saving,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(config);
  const [pick, setPick] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(config));
      setPick(null);
      setMsg(null);
    }
  }, [open, config]);

  if (!open) return null;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      Array.from(files)
        .slice(0, 24)
        .forEach((f) => fd.append('images', f));
      const res = await api<{ ok: boolean; urls: string[] }>('/api/admin/settings/menu-games/images', {
        method: 'POST',
        body: fd,
      });
      setDraft((d) => ({
        ...d,
        memory: {
          ...d.memory,
          pool: [...d.memory.pool, ...(res.urls || [])].slice(0, 48),
        },
      }));
      setMsg(`${res.urls?.length || 0} görsel yüklendi. Aynı olan iki görseli sırayla seçerek eşleştirin.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function clickPool(url: string) {
    if (!pick) {
      setPick(url);
      return;
    }
    if (pick === url) {
      setPick(null);
      return;
    }
    const pair: MemoryPair = { id: newId(), imageA: pick, imageB: url };
    setDraft((d) => ({
      ...d,
      memory: {
        ...d.memory,
        pairs: [...d.memory.pairs, pair].slice(0, 24),
        pool: d.memory.pool.filter((u) => u !== pick && u !== url),
      },
    }));
    setPick(null);
    setMsg('Çift eklendi.');
  }

  function removePair(id: string) {
    setDraft((d) => {
      const p = d.memory.pairs.find((x) => x.id === id);
      if (!p) return d;
      return {
        ...d,
        memory: {
          ...d.memory,
          pairs: d.memory.pairs.filter((x) => x.id !== id),
          pool: [...d.memory.pool, p.imageA, p.imageB].slice(0, 48),
        },
      };
    });
  }

  function removePool(url: string) {
    setDraft((d) => ({
      ...d,
      memory: { ...d.memory, pool: d.memory.pool.filter((u) => u !== url) },
    }));
    if (pick === url) setPick(null);
  }

  const need = draft.memory.pairCount;
  const have = draft.memory.pairs.length;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Kapat" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-600">Hafıza oyunu</p>
            <h3 className="text-lg font-bold text-slate-900">Ayarlar</h3>
          </div>
          <button type="button" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="space-y-5 p-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Zorluk (kaç çift)</span>
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={draft.memory.pairCount}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  memory: { ...d.memory, pairCount: Number(e.target.value) as MemoryPairCount },
                }))
              }
            >
              <option value={4}>Kolay — 4 çift (8 kart)</option>
              <option value={6}>Orta — 6 çift (12 kart)</option>
              <option value={8}>Zor — 8 çift (16 kart)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Özel görsel yoksa varsayılan emoji kartlar kullanılır. Özel çift: {have}/{need}
              {have < need ? ' — eksik çiftler emoji ile tamamlanır.' : ' ✓'}
            </p>
          </label>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-700">Görseller</span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="w-3.5 h-3.5" />
                {uploading ? 'Yükleniyor…' : 'Toplu yükle'}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void onFiles(e.target.files)}
              />
            </div>
            <p className="text-xs text-slate-500 mb-3">
              İsterseniz kendi resimlerinizi yükleyin. Aynı olan iki kartı sırayla tıklayarak eşleştirin.
            </p>

            {draft.memory.pool.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Havuz boş. Toplu yükleme ile başlayın.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {draft.memory.pool.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                      pick === url ? 'border-sky-500 ring-2 ring-sky-200' : 'border-slate-200'
                    }`}
                    onClick={() => clickPool(url)}
                  >
                    <img src={imageUrl(url)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-md bg-black/55 p-1 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePool(url);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}
            {pick ? (
              <p className="mt-2 text-xs font-semibold text-sky-700 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> Eşlemek için ikinci görseli seçin
              </p>
            ) : null}
          </div>

          <div>
            <span className="text-sm font-semibold text-slate-700">Eşleşen çiftler</span>
            {draft.memory.pairs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Henüz çift yok.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {draft.memory.pairs.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <img src={imageUrl(p.imageA)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <img src={imageUrl(p.imageB)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <button
                      type="button"
                      className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-white"
                      onClick={() => removePair(p.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {msg ? <p className="text-sm text-sky-800 bg-sky-50 rounded-xl px-3 py-2">{msg}</p> : null}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void onSave(draft)}
          >
            <Settings2 className="w-4 h-4" />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
