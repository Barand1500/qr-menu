import { useEffect, useState } from 'react';
import { Plus, Settings2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { DetectiveAdminQuestion, MenuGamesConfig } from '@/lib/menuGamesConfig';

type Props = {
  open: boolean;
  config: MenuGamesConfig;
  saving?: boolean;
  onClose: () => void;
  onSave: (next: MenuGamesConfig) => Promise<void>;
};

function newId() {
  return `dq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function emptyQuestion(): DetectiveAdminQuestion {
  return {
    id: newId(),
    prompt: '',
    choices: ['', '', '', ''],
    correctIndex: 0,
  };
}

export default function DetectiveGameSettingsModal({
  open,
  config,
  saving,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(config);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(config));
      setMsg(null);
    }
  }, [open, config]);

  if (!open) return null;

  function updateQuestion(id: string, patch: Partial<DetectiveAdminQuestion>) {
    setDraft((d) => ({
      ...d,
      detective: {
        ...d.detective,
        questions: d.detective.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      },
    }));
  }

  function updateChoice(id: string, index: number, value: string) {
    setDraft((d) => ({
      ...d,
      detective: {
        ...d.detective,
        questions: d.detective.questions.map((q) => {
          if (q.id !== id) return q;
          const choices = [...q.choices];
          choices[index] = value;
          return { ...q, choices };
        }),
      },
    }));
  }

  async function save() {
    const cleaned = draft.detective.questions
      .map((q) => ({
        ...q,
        prompt: q.prompt.trim(),
        choices: q.choices.map((c) => c.trim()),
      }))
      .filter((q) => q.prompt && q.choices.every((c) => c.length > 0));

    if (draft.detective.questions.length && cleaned.length !== draft.detective.questions.length) {
      setMsg('Tüm soru ve şıkları doldurun (4 şık).');
      return;
    }

    await onSave({
      ...draft,
      detective: { ...draft.detective, questions: cleaned },
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Kapat" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <Settings2 className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">Menü Dedektifi ayarları</h2>
            <p className="text-xs text-slate-500">
              Eklediğiniz sorular önce sorulur. Boşsa 100 soruluk hazır havuz kullanılır.
            </p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {msg ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {msg}
            </div>
          ) : null}

          {draft.detective.questions.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              Henüz özel soru yok. Hazır havuz (100 soru) otomatik kullanılır.
            </p>
          ) : null}

          {draft.detective.questions.map((q, qi) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Soru {qi + 1}</p>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      detective: {
                        ...d.detective,
                        questions: d.detective.questions.filter((x) => x.id !== q.id),
                      },
                    }))
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Soru metni"
                value={q.prompt}
                onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, i) => (
                  <label key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctIndex === i}
                      onChange={() => updateQuestion(q.id, { correctIndex: i })}
                    />
                    <span className="text-xs font-bold text-slate-400">{String.fromCharCode(65 + i)}</span>
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                      placeholder={`Şık ${String.fromCharCode(65 + i)}`}
                      value={c}
                      onChange={(e) => updateChoice(q.id, i, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p className="text-[0.7rem] text-slate-400">Doğru şıkkı radyo ile seçin.</p>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            disabled={draft.detective.questions.length >= 50}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                detective: {
                  ...d.detective,
                  questions: [...d.detective.questions, emptyQuestion()],
                },
              }))
            }
          >
            <Plus className="w-4 h-4" />
            Soru ekle
          </Button>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            Kaydet
          </Button>
        </footer>
      </div>
    </div>
  );
}
