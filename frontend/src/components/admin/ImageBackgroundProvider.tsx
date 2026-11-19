import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import AdminToast, { type AdminToastNotice } from '@/components/admin/AdminToast';
import ImageBackgroundRemover, {
  type BackgroundDecision,
  type ImageBackgroundMode,
} from '@/components/admin/ImageBackgroundRemover';
import { autoRemoveBackground, isEligibleImage, processFile } from '@/lib/removeBackground';

type PrepareOptions = {
  /** Pencerede geçen ad: "Ürün görseli", "Grup görseli", "Logo". */
  subject?: string;
  /** Kayıtlı moda bakmadan her zaman sor (logo). Seçim kaydedilmez. */
  forceAsk?: boolean;
};

type Value = {
  /** undefined: yükleniyor, null: henüz seçilmemiş. */
  mode: ImageBackgroundMode | null | undefined;
  /**
   * Yüklenecek görselleri işletmenin ayarına göre hazırlar: sorar, otomatik siler ya da dokunmaz.
   * Vazgeçilirse null döner (yükleme yapılmamalı).
   */
  prepare: (files: File[], options?: PrepareOptions) => Promise<File[] | null>;
  /** Ayarlar sayfasından davranışı değiştirir (hemen kaydedilir). */
  setMode: (mode: ImageBackgroundMode) => Promise<void>;
};

const Context = createContext<Value>({
  mode: null,
  prepare: async (files) => files,
  setMode: async () => {},
});

export const useImageBackground = () => useContext(Context);

type Request = {
  all: File[];
  eligible: File[];
  subject: string;
  remember: boolean;
  settingsHint: boolean;
  resolve: (files: File[] | null) => void;
};

/**
 * Ürün, grup ve logo görsellerinde "arka planı sil" kararını tek yerden yönetir. Mod işletme geneli kaydedilir:
 * ask (her seferinde sor), auto (arka planı düzse otomatik sil), never (hiç sorma). Kayıt yoksa ilk yüklemede
 * pencere "bundan sonra" seçimini de sorar.
 */
export function ImageBackgroundProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ImageBackgroundMode | null | undefined>(undefined);
  const modeRef = useRef<ImageBackgroundMode | null | undefined>(undefined);
  const loadRef = useRef<Promise<void> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [request, setRequest] = useState<Request | null>(null);
  const [notice, setNotice] = useState<AdminToastNotice>(null);

  const apply = (next: ImageBackgroundMode | null) => {
    modeRef.current = next;
    setModeState(next);
  };

  const load = useCallback(() => {
    if (!loadRef.current) {
      loadRef.current = api<{ mode: ImageBackgroundMode | null }>('/api/admin/settings/image-background')
        .then((res) => apply(res.mode))
        .catch(() => apply(null));
    }
    return loadRef.current;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (next: ImageBackgroundMode) => {
    await api('/api/admin/settings/image-background', {
      method: 'PUT',
      body: JSON.stringify({ mode: next }),
    });
    apply(next);
  }, []);

  const prepare = useCallback<Value['prepare']>(
    (files, options = {}) => {
      const run = async (): Promise<File[] | null> => {
        const eligible = files.filter(isEligibleImage);
        if (!eligible.length) return files;
        let current: ImageBackgroundMode | null = 'ask';
        if (!options.forceAsk) {
          await load();
          current = modeRef.current ?? null;
        }
        if (current === 'never') return files;
        if (current === 'auto') {
          let changed = 0;
          const out: File[] = [];
          for (const file of files) {
            if (!isEligibleImage(file)) {
              out.push(file);
              continue;
            }
            try {
              const result = await autoRemoveBackground(file);
              if (result) changed++;
              out.push(result ?? file);
            } catch {
              out.push(file);
            }
          }
          if (changed > 0) {
            setNotice({
              error: false,
              text:
                changed === 1
                  ? 'Düz arka planlı görselin arka planı silindi.'
                  : `${changed} görselin düz arka planı silindi.`,
            });
          }
          return out;
        }
        // ask: kayıtlı "her seferinde sor" ya da henüz hiç seçilmemiş (null) ilk karşılaşma
        return new Promise<File[] | null>((resolve) => {
          setRequest({
            all: files,
            eligible,
            subject: options.subject || 'Görsel',
            remember: !options.forceAsk && current === null,
            settingsHint: !options.forceAsk && current === 'ask',
            resolve,
          });
        });
      };
      // Aynı anda gelen istekler sırayla işlenir (tek pencere)
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => undefined);
      return next;
    },
    [load],
  );

  const setMode = useCallback(
    async (next: ImageBackgroundMode) => {
      await save(next);
    },
    [save],
  );

  async function finish(decision: BackgroundDecision, progress: (done: number, total: number) => void) {
    const req = request;
    if (!req) return;
    const results = new Map<File, File>();
    let done = 0;
    for (const file of req.eligible) {
      results.set(file, decision.remove ? await processFile(file, decision.options) : file);
      progress(++done, req.eligible.length);
    }
    if (decision.remember) {
      try {
        await save(decision.remember);
        setNotice({
          error: false,
          text: 'Seçiminiz kaydedildi. Ayarlar > İşletme > Görseller bölümünden değiştirebilirsiniz.',
        });
      } catch {
        setNotice({ error: true, text: 'Görsel hazırlandı ama seçiminiz kaydedilemedi.' });
      }
    }
    req.resolve(req.all.map((file) => results.get(file) ?? file));
    setRequest(null);
  }

  function cancel() {
    request?.resolve(null);
    setRequest(null);
  }

  const value = useMemo<Value>(() => ({ mode, prepare, setMode }), [mode, prepare, setMode]);

  return (
    <Context.Provider value={value}>
      {children}
      {request && (
        <ImageBackgroundRemover
          files={request.eligible}
          subject={request.subject}
          remember={request.remember}
          settingsHint={request.settingsHint}
          onFinish={finish}
          onCancel={cancel}
        />
      )}
      <AdminToast notice={notice} onClose={() => setNotice(null)} />
    </Context.Provider>
  );
}
