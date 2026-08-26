import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, StickyNote, X, Pencil, Trash2 } from 'lucide-react';

const DAYS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const NOTES_KEY = 'menu_qr_calendar_notes';

interface DayNote {
  text: string;
  updatedAt: string;
}

type NotesMap = Record<string, DayNote>;

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function loadNotes(): NotesMap {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveNotes(notes: NotesMap) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export default function DashboardCalendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [notes, setNotes] = useState<NotesMap>(loadNotes);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { days, monthLabel } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);

    return { days: cells, monthLabel: `${MONTHS_TR[month]} ${year}` };
  }, [year, month]);

  const selectedKey =
    selectedDay !== null ? dateKey(year, month, selectedDay) : null;
  const selectedNote = selectedKey ? notes[selectedKey] : null;

  useEffect(() => {
    if (modalOpen && selectedNote) {
      setNoteText(selectedNote.text);
      setEditMode(false);
    } else if (modalOpen) {
      setNoteText('');
      setEditMode(true);
    }
  }, [modalOpen, selectedNote, selectedKey]);

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const hasNote = (day: number) => !!notes[dateKey(year, month, day)];

  function handleDayClick(day: number) {
    setSelectedDay(day);
    setModalOpen(true);
  }

  function handleDayDoubleClick(day: number) {
    setSelectedDay(day);
    setNoteText(notes[dateKey(year, month, day)]?.text || '');
    setEditMode(true);
    setModalOpen(true);
  }

  function handleSave() {
    if (!selectedKey || !noteText.trim()) return;
    const updated = {
      ...notes,
      [selectedKey]: { text: noteText.trim(), updatedAt: new Date().toISOString() },
    };
    setNotes(updated);
    saveNotes(updated);
    setEditMode(false);
  }

  function handleDelete() {
    if (!selectedKey) return;
    const updated = { ...notes };
    delete updated[selectedKey];
    setNotes(updated);
    saveNotes(updated);
    setNoteText('');
    setModalOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-[var(--admin-text)]">{monthLabel}</h4>
        <div className="flex gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
          </button>
        </div>
      </div>

      <p className="text-[11px] admin-text-subtle mb-3">
        Tıkla: notu gör · Çift tıkla: not ekle/düzenle
      </p>

      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
        {DAYS_TR.map((d) => (
          <div key={d} className="text-[11px] font-semibold py-1.5 admin-text-muted">
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;
          const selected = selectedDay === day && modalOpen;
          const todayMark = isToday(day);
          const noted = hasNote(day);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(day)}
              onDoubleClick={() => handleDayDoubleClick(day)}
              className="relative aspect-square flex items-center justify-center mx-auto w-full max-w-[36px]"
            >
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  todayMark || selected ? 'shadow-sm' : 'hover:bg-[var(--admin-accent-soft)]'
                }`}
                style={
                  todayMark
                    ? { background: 'var(--admin-accent)', color: '#ffffff' }
                    : selected
                      ? {
                          background: 'var(--admin-accent-soft)',
                          color: 'var(--admin-accent-text)',
                          outline: '2px solid var(--admin-accent)',
                        }
                      : { color: 'var(--admin-text)' }
                }
              >
                {day}
              </span>
              {noted && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ background: noted && !todayMark ? 'var(--admin-accent)' : '#ffffff' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Note modal */}
      {modalOpen && selectedDay !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
        >
          <div
            className="admin-card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
                <h3 className="font-semibold text-[var(--admin-text)]">
                  {selectedDay} {MONTHS_TR[month]} {year}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--admin-accent-soft)]"
              >
                <X className="w-4 h-4 admin-text-muted" />
              </button>
            </div>

            {editMode || !selectedNote ? (
              <>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Bu güne not bırak..."
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--admin-accent-soft)]"
                  style={{
                    background: 'var(--admin-input-bg)',
                    borderColor: 'var(--admin-input-border)',
                    color: 'var(--admin-text)',
                  }}
                  autoFocus
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={!noteText.trim()}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: 'var(--admin-accent)' }}
                  >
                    Kaydet
                  </button>
                  {selectedNote && (
                    <button
                      onClick={handleDelete}
                      className="px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--admin-text)] leading-relaxed whitespace-pre-wrap min-h-[80px]">
                  {selectedNote.text}
                </p>
                <p className="text-[11px] admin-text-subtle mt-2">
                  {new Date(selectedNote.updatedAt).toLocaleString('tr-TR')}
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{
                      background: 'var(--admin-accent-soft)',
                      color: 'var(--admin-accent-text)',
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Düzenle
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Sil
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
