import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  StickyNote,
  X,
  Pencil,
  Trash2,
  Maximize2,
  Plus,
  CalendarDays,
  NotebookPen,
} from 'lucide-react';

const DAYS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const NOTES_KEY = 'menu_qr_calendar_notes';
const FREE_NOTES_KEY = 'menu_qr_calendar_free_notes';
const NOTES_PER_PAGE = 5;
const FREE_PER_PAGE = 4;

interface DayNote {
  text: string;
  updatedAt: string;
}

interface FreeNote {
  id: string;
  text: string;
  updatedAt: string;
}

type NotesMap = Record<string, DayNote>;

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
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

function loadFreeNotes(): FreeNote[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FREE_NOTES_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveFreeNotes(list: FreeNote[]) {
  localStorage.setItem(FREE_NOTES_KEY, JSON.stringify(list));
}

function formatNoteDate(key: string) {
  const { year, month, day } = parseKey(key);
  return `${day} ${MONTHS_TR[month]} ${year}`;
}

function buildMonthCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);

  return {
    days: cells,
    label: `${MONTHS_TR[month]} ${year}`,
  };
}

export default function DashboardCalendar({ showTitle = false }: { showTitle?: boolean }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [notes, setNotes] = useState<NotesMap>(loadNotes);
  const [freeNotes, setFreeNotes] = useState<FreeNote[]>(loadFreeNotes);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [modalOpen, setModalOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [freeDraft, setFreeDraft] = useState('');
  const [editingFreeId, setEditingFreeId] = useState<string | null>(null);
  const [freeEditText, setFreeEditText] = useState('');
  const [notesPage, setNotesPage] = useState(0);
  const [freePage, setFreePage] = useState(0);

  useEffect(() => {
    if (!modalOpen && !fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (modalOpen) setModalOpen(false);
        else setFullscreen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const nextMonthDate = useMemo(() => new Date(year, month + 1, 1), [year, month]);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth();

  const primaryMonth = useMemo(() => buildMonthCells(year, month), [year, month]);
  const secondaryMonth = useMemo(
    () => buildMonthCells(nextYear, nextMonth),
    [nextYear, nextMonth]
  );

  const selectedKey =
    selectedDay !== null ? dateKey(year, month, selectedDay) : null;
  const selectedNote = selectedKey ? notes[selectedKey] : null;

  const monthNotes = useMemo(() => {
    const prefixes = [
      `${year}-${String(month + 1).padStart(2, '0')}-`,
      `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-`,
    ];
    return Object.entries(notes)
      .filter(([key]) => prefixes.some((p) => key.startsWith(p)))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [notes, year, month, nextYear, nextMonth]);

  const notesPageCount = Math.max(1, Math.ceil(monthNotes.length / NOTES_PER_PAGE));
  const pagedMonthNotes = useMemo(() => {
    const page = Math.min(notesPage, notesPageCount - 1);
    const start = page * NOTES_PER_PAGE;
    return monthNotes.slice(start, start + NOTES_PER_PAGE);
  }, [monthNotes, notesPage, notesPageCount]);

  const freePageCount = Math.max(1, Math.ceil(freeNotes.length / FREE_PER_PAGE));
  const pagedFreeNotes = useMemo(() => {
    const page = Math.min(freePage, freePageCount - 1);
    const start = page * FREE_PER_PAGE;
    return freeNotes.slice(start, start + FREE_PER_PAGE);
  }, [freeNotes, freePage, freePageCount]);

  useEffect(() => {
    setNotesPage(0);
  }, [year, month]);

  useEffect(() => {
    if (notesPage > notesPageCount - 1) setNotesPage(Math.max(0, notesPageCount - 1));
  }, [notesPage, notesPageCount]);

  useEffect(() => {
    if (freePage > freePageCount - 1) setFreePage(Math.max(0, freePageCount - 1));
  }, [freePage, freePageCount]);

  useEffect(() => {
    if (modalOpen && selectedNote) {
      setNoteText(selectedNote.text);
      setEditMode(false);
    } else if (modalOpen) {
      setNoteText('');
      setEditMode(true);
    }
  }, [modalOpen, selectedNote, selectedKey]);

  useEffect(() => {
    if (!fullscreen || selectedDay === null) return;
    if (selectedNote) {
      setNoteText(selectedNote.text);
      setEditMode(false);
    } else {
      setNoteText('');
      setEditMode(true);
    }
  }, [fullscreen, selectedDay, selectedKey, selectedNote]);

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }

  function nextMonthNav() {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
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
    setEditMode(true);
    if (!fullscreen) setModalOpen(false);
  }

  function openFullscreen() {
    if (selectedDay === null) {
      setSelectedDay(
        today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1
      );
    }
    setModalOpen(false);
    setFullscreen(true);
  }

  function selectNoteFromList(key: string) {
    const { year: y, month: m, day } = parseKey(key);
    setViewDate(new Date(y, m, 1));
    setSelectedDay(day);
  }

  function selectDay(y: number, m: number, day: number, openModal: boolean) {
    if (y !== year || m !== month) {
      setViewDate(new Date(y, m, 1));
    }
    setSelectedDay(day);
    if (openModal && !fullscreen) {
      setNoteText(notes[dateKey(y, m, day)]?.text || '');
      setEditMode(true);
      setModalOpen(true);
    }
  }

  function addFreeNote() {
    const text = freeDraft.trim();
    if (!text) return;
    const next: FreeNote[] = [
      {
        id: crypto.randomUUID(),
        text,
        updatedAt: new Date().toISOString(),
      },
      ...freeNotes,
    ];
    setFreeNotes(next);
    saveFreeNotes(next);
    setFreeDraft('');
    setFreePage(0);
  }

  function saveFreeEdit() {
    if (!editingFreeId || !freeEditText.trim()) return;
    const next = freeNotes.map((n) =>
      n.id === editingFreeId
        ? { ...n, text: freeEditText.trim(), updatedAt: new Date().toISOString() }
        : n
    );
    setFreeNotes(next);
    saveFreeNotes(next);
    setEditingFreeId(null);
    setFreeEditText('');
  }

  function deleteFreeNote(id: string) {
    const next = freeNotes.filter((n) => n.id !== id);
    setFreeNotes(next);
    saveFreeNotes(next);
    if (editingFreeId === id) {
      setEditingFreeId(null);
      setFreeEditText('');
    }
  }

  function renderMonthGrid(
    y: number,
    m: number,
    days: (number | null)[],
    size: 'compact' | 'full' | 'secondary'
  ) {
    const maxW = size === 'compact' ? 'max-w-[36px]' : 'max-w-[48px]';
    const cell =
      size === 'compact'
        ? 'w-8 h-8 text-sm'
        : size === 'secondary'
          ? 'w-8 h-8 text-sm'
          : 'w-9 h-9 text-[0.95rem]';
    const isPrimaryView = y === year && m === month;

    return (
      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 text-center">
        {DAYS_TR.map((d) => (
          <div
            key={d}
            className={`font-semibold py-1 admin-text-muted ${
              size === 'compact' ? 'text-[11px]' : 'text-[11px]'
            }`}
          >
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = dateKey(y, m, day);
          const selected = isPrimaryView && selectedDay === day && (modalOpen || fullscreen);
          const todayMark =
            day === today.getDate() &&
            m === today.getMonth() &&
            y === today.getFullYear();
          const noted = !!notes[key];

          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(y, m, day, !fullscreen)}
              onDoubleClick={() => selectDay(y, m, day, true)}
              className={`relative aspect-square flex items-center justify-center mx-auto w-full ${maxW}`}
            >
              <span
                className={`${cell} flex items-center justify-center rounded-full font-semibold transition-all ${
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
                      : {
                          color:
                            size === 'secondary'
                              ? 'var(--admin-text-muted)'
                              : 'var(--admin-text)',
                        }
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
    );
  }

  function renderNoteEditor() {
    if (selectedDay === null) {
      return (
        <div className="dash-cal-empty">
          <CalendarDays className="w-8 h-8 opacity-40" />
          <p>Not görmek veya eklemek için bir gün seçin</p>
        </div>
      );
    }

    return (
      <div className="dash-cal-editor">
        <div className="dash-cal-editor__head">
          <div>
            <p className="dash-cal-editor__label">Seçili gün</p>
            <h4 className="dash-cal-editor__date">
              {selectedDay} {MONTHS_TR[month]} {year}
            </h4>
          </div>
          {selectedNote && !editMode && (
            <button
              type="button"
              className="dash-cal-icon-btn"
              onClick={() => setEditMode(true)}
              aria-label="Düzenle"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {editMode || !selectedNote ? (
          <>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Bu güne not bırakın… (hatırlatma, randevu, görev)"
              rows={4}
              className="dash-cal-textarea"
              autoFocus={fullscreen}
            />
            <div className="dash-cal-editor__actions">
              <button
                type="button"
                onClick={handleSave}
                disabled={!noteText.trim()}
                className="dash-cal-btn dash-cal-btn--primary"
              >
                Kaydet
              </button>
              {selectedNote && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="dash-cal-btn dash-cal-btn--danger"
                >
                  <Trash2 className="w-4 h-4" />
                  Sil
                </button>
              )}
              {selectedNote && editMode && (
                <button
                  type="button"
                  onClick={() => {
                    setNoteText(selectedNote.text);
                    setEditMode(false);
                  }}
                  className="dash-cal-btn dash-cal-btn--ghost"
                >
                  Vazgeç
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="dash-cal-editor__body">{selectedNote.text}</p>
            <p className="dash-cal-editor__meta">
              Son güncelleme · {new Date(selectedNote.updatedAt).toLocaleString('tr-TR')}
            </p>
            <div className="dash-cal-editor__actions">
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="dash-cal-btn dash-cal-btn--soft"
              >
                <Pencil className="w-3.5 h-3.5" />
                Düzenle
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="dash-cal-btn dash-cal-btn--danger"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sil
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {showTitle && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
            <h3 className="font-semibold text-[var(--admin-text)]">Takvim</h3>
          </div>
          <button type="button" className="dash-cal-fullscreen-link" onClick={openFullscreen}>
            <Maximize2 className="w-3.5 h-3.5" />
            Tam ekran
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-semibold text-[var(--admin-text)]">{primaryMonth.label}</h4>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
                aria-label="Önceki ay"
              >
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
              </button>
              <button
                type="button"
                onClick={nextMonthNav}
                className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
                aria-label="Sonraki ay"
              >
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--admin-text-muted)' }} />
              </button>
            </div>
          </div>
          <p className="text-[11px] admin-text-subtle">
            Tıkla: notu gör · Çift tıkla: not ekle/düzenle
          </p>
        </div>
        {!showTitle && (
          <button type="button" className="dash-cal-fullscreen-link" onClick={openFullscreen}>
            <Maximize2 className="w-3.5 h-3.5" />
            Tam ekran
          </button>
        )}
      </div>

      <div className="mt-3">
        {renderMonthGrid(year, month, primaryMonth.days, 'compact')}
      </div>

      {modalOpen && selectedDay !== null && !fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          onClick={() => setModalOpen(false)}
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
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--admin-accent-soft)]"
              >
                <X className="w-4 h-4 admin-text-muted" />
              </button>
            </div>
            {renderNoteEditor()}
            <button
              type="button"
              className="dash-cal-fullscreen-link mt-4"
              onClick={openFullscreen}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Tam ekranda aç
            </button>
          </div>
        </div>
      )}

      {fullscreen && (
        <div className="dash-cal-fs" role="dialog" aria-modal="true" aria-label="Takvim tam ekran">
          <div className="dash-cal-fs__shell">
            <header className="dash-cal-fs__header">
              <div className="dash-cal-fs__brand">
                <span className="dash-cal-fs__icon" aria-hidden>
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div>
                  <h2>Takvim</h2>
                  <p>Notlarınızı günlere ekleyin, ay boyunca takip edin</p>
                </div>
              </div>
              <button
                type="button"
                className="dash-cal-fs__close"
                onClick={() => setFullscreen(false)}
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="dash-cal-fs__body">
              <section className="dash-cal-fs__calendar">
                <div className="dash-cal-fs__month-nav">
                  <h3>{primaryMonth.label}</h3>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="dash-cal-icon-btn"
                      aria-label="Önceki ay"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonthNav}
                      className="dash-cal-icon-btn"
                      aria-label="Sonraki ay"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {renderMonthGrid(year, month, primaryMonth.days, 'full')}

                <div className="dash-cal-fs__next-month">
                  <div className="dash-cal-fs__next-month-head">
                    <h4>{secondaryMonth.label}</h4>
                    <span>Sıradaki ay</span>
                  </div>
                  {renderMonthGrid(nextYear, nextMonth, secondaryMonth.days, 'secondary')}
                </div>
              </section>

              <aside className="dash-cal-fs__aside">
                <div className="dash-cal-fs__panel">{renderNoteEditor()}</div>

                <div className="dash-cal-fs__panel dash-cal-fs__notes">
                  <div className="dash-cal-fs__notes-head">
                    <h4>
                      <StickyNote className="w-4 h-4" />
                      Ekrandaki ayların notları
                      {monthNotes.length > 0 && (
                        <span className="dash-cal-fs__count">{monthNotes.length}</span>
                      )}
                    </h4>
                  </div>
                  <p className="dash-cal-fs__free-hint">
                    {primaryMonth.label} ve {secondaryMonth.label}
                  </p>

                  {monthNotes.length === 0 ? (
                    <div className="dash-cal-empty dash-cal-empty--sm">
                      <p>Bu aylarda henüz gün notu yok. Takvimden bir gün seçip not ekleyin.</p>
                    </div>
                  ) : (
                    <>
                      <ul className="dash-cal-note-list">
                        {pagedMonthNotes.map(([key, note]) => {
                          const active = key === selectedKey;
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                className={`dash-cal-note-item${active ? ' is-active' : ''}`}
                                onClick={() => selectNoteFromList(key)}
                              >
                                <span className="dash-cal-note-item__day">
                                  {parseKey(key).day}
                                </span>
                                <span className="dash-cal-note-item__copy">
                                  <strong>{formatNoteDate(key)}</strong>
                                  <span>{note.text}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {monthNotes.length > NOTES_PER_PAGE && (
                        <div className="dash-cal-pager">
                          <button
                            type="button"
                            className="dash-cal-icon-btn"
                            disabled={notesPage <= 0}
                            onClick={() => setNotesPage((p) => Math.max(0, p - 1))}
                            aria-label="Önceki sayfa"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span>
                            {Math.min(notesPage, notesPageCount - 1) + 1} / {notesPageCount}
                          </span>
                          <button
                            type="button"
                            className="dash-cal-icon-btn"
                            disabled={notesPage >= notesPageCount - 1}
                            onClick={() =>
                              setNotesPage((p) => Math.min(notesPageCount - 1, p + 1))
                            }
                            aria-label="Sonraki sayfa"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="dash-cal-fs__panel dash-cal-fs__free">
                  <div className="dash-cal-fs__notes-head">
                    <h4>
                      <NotebookPen className="w-4 h-4" />
                      Günsüz not
                      {freeNotes.length > 0 && (
                        <span className="dash-cal-fs__count">{freeNotes.length}</span>
                      )}
                    </h4>
                  </div>
                  <p className="dash-cal-fs__free-hint">
                    Güne bağlamadan hızlı not bırakın — buraya kaydolur.
                  </p>
                  <textarea
                    value={freeDraft}
                    onChange={(e) => setFreeDraft(e.target.value)}
                    placeholder="Örn: Siparişleri kontrol et, personel toplantısı…"
                    rows={2}
                    className="dash-cal-textarea dash-cal-textarea--sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        addFreeNote();
                      }
                    }}
                  />
                  <div className="dash-cal-editor__actions">
                    <button
                      type="button"
                      onClick={addFreeNote}
                      disabled={!freeDraft.trim()}
                      className="dash-cal-btn dash-cal-btn--primary dash-cal-btn--sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ekle
                    </button>
                  </div>

                  {freeNotes.length > 0 && (
                    <>
                      <ul className="dash-cal-free-list">
                        {pagedFreeNotes.map((note) => (
                          <li key={note.id} className="dash-cal-free-item">
                            {editingFreeId === note.id ? (
                              <>
                                <textarea
                                  value={freeEditText}
                                  onChange={(e) => setFreeEditText(e.target.value)}
                                  rows={2}
                                  className="dash-cal-textarea dash-cal-textarea--sm"
                                  autoFocus
                                />
                                <div className="dash-cal-editor__actions">
                                  <button
                                    type="button"
                                    className="dash-cal-btn dash-cal-btn--primary dash-cal-btn--sm"
                                    onClick={saveFreeEdit}
                                    disabled={!freeEditText.trim()}
                                  >
                                    Kaydet
                                  </button>
                                  <button
                                    type="button"
                                    className="dash-cal-btn dash-cal-btn--ghost dash-cal-btn--sm"
                                    onClick={() => {
                                      setEditingFreeId(null);
                                      setFreeEditText('');
                                    }}
                                  >
                                    Vazgeç
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p>{note.text}</p>
                                <div className="dash-cal-free-item__meta">
                                  <em>
                                    {new Date(note.updatedAt).toLocaleString('tr-TR', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </em>
                                  <div className="dash-cal-free-item__actions">
                                    <button
                                      type="button"
                                      aria-label="Düzenle"
                                      onClick={() => {
                                        setEditingFreeId(note.id);
                                        setFreeEditText(note.text);
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Sil"
                                      onClick={() => deleteFreeNote(note.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                      {freeNotes.length > FREE_PER_PAGE && (
                        <div className="dash-cal-pager">
                          <button
                            type="button"
                            className="dash-cal-icon-btn"
                            disabled={freePage <= 0}
                            onClick={() => setFreePage((p) => Math.max(0, p - 1))}
                            aria-label="Önceki sayfa"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span>
                            {Math.min(freePage, freePageCount - 1) + 1} / {freePageCount}
                          </span>
                          <button
                            type="button"
                            className="dash-cal-icon-btn"
                            disabled={freePage >= freePageCount - 1}
                            onClick={() =>
                              setFreePage((p) => Math.min(freePageCount - 1, p + 1))
                            }
                            aria-label="Sonraki sayfa"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
