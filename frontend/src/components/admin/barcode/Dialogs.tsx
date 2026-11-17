import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { Button } from '@/components/ui';
import { defaultTableStyle, normalizePrefix } from './qr';

export function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="bq-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} azalt`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus size={18} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={label}
        value={value}
        onChange={(e) =>
          onChange(clamp(Math.round(Number(e.target.value)) || min))
        }
      />
      <button
        type="button"
        aria-label={`${label} artır`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function Shell({
  label,
  eyebrow,
  title,
  busy,
  onClose,
  onSubmit,
  footer,
  children,
}: {
  label: string;
  eyebrow: string;
  title: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit?: (e: FormEvent) => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminOverlay
      label={label}
      busy={busy}
      onClose={onClose}
      className="bq-overlay"
    >
      <form className="bq-dialog" onSubmit={onSubmit}>
        <header className="bq-dialog__head">
          <div>
            <span className="bq-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="bq-icon"
            aria-label="Pencereyi kapat"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="bq-dialog__scroll admin-scroll">{children}</div>
        <footer className="bq-dialog__foot">{footer}</footer>
      </form>
    </AdminOverlay>
  );
}

export type GroupForm = { name: string; count: number; prefix: string };
export function GroupDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Present when renaming/editing an existing group. */
  initial: GroupForm | null;
  onClose: () => void;
  onSubmit: (data: GroupForm) => void;
}) {
  const [form, setForm] = useState<GroupForm>({
    name: '',
    count: 8,
    prefix: '',
  });
  useEffect(() => {
    if (open) setForm(initial || { name: '', count: 8, prefix: '' });
    // Snapshot on open; parent notifications must not overwrite a typed draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  const name = form.name.trim();
  const samples = [1, 2, 3].map(
    (n) => defaultTableStyle(n, name || 'Masa', form.prefix).name,
  );
  return (
    <Shell
      label={initial ? 'Grubu düzenle' : 'Yeni grup'}
      eyebrow="MASA GRUBU"
      title={initial ? 'Grubu düzenle' : 'Yeni grup'}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (name) onSubmit({ ...form, name });
      }}
      footer={
        <Button type="submit" disabled={!name}>
          {initial ? 'Kaydet' : 'Grubu ekle'}
        </Button>
      }
    >
      <div className="bq-form">
        <label className="bq-input">
          <span>Grup adı</span>
          <input
            autoFocus
            value={form.name}
            maxLength={40}
            placeholder="Örn. Bahçe"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div className="bq-field">
          <div className="bq-field__label">
            <span>Masa sayısı</span>
            <small>En fazla 60</small>
          </div>
          <Stepper
            label="Masa sayısı"
            value={form.count}
            min={1}
            max={60}
            onChange={(count) => setForm({ ...form, count })}
          />
        </div>
        <label className="bq-input">
          <span>Önek (isteğe bağlı)</span>
          <input
            value={form.prefix}
            maxLength={20}
            placeholder="Örn. b"
            onChange={(e) =>
              setForm({ ...form, prefix: normalizePrefix(e.target.value) })
            }
          />
        </label>
        <div className="bq-samples" aria-live="polite">
          <small>Masa adları</small>
          {samples.map((s) => (
            <span key={s}>{s}</span>
          ))}
          <span>…</span>
        </div>
      </div>
    </Shell>
  );
}

export function CampaignDialog({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);
  if (!open) return null;
  return (
    <Shell
      label="Yeni kampanya"
      eyebrow="KAMPANYA"
      title="Yeni kampanya"
      busy={saving}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && !saving) onSubmit(name.trim());
      }}
      footer={
        <Button type="submit" disabled={!name.trim() || saving}>
          {saving ? 'Ekleniyor…' : 'Kampanyayı ekle'}
        </Button>
      }
    >
      <div className="bq-form">
        <label className="bq-input">
          <span>Kampanya adı</span>
          <input
            autoFocus
            value={name}
            maxLength={60}
            placeholder="Örn. Yaz kampanyası"
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="bq-note">
          Ekledikten sonra kampanyanın özel menüsünü hazırlarsın. Bu QR’ı okutan
          müşteri o menüyü görür.
        </p>
      </div>
    </Shell>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <Shell
      label={title}
      eyebrow="ONAY"
      title={title}
      busy={busy}
      onClose={onClose}
      footer={
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? 'Siliniyor…' : confirmLabel}
        </Button>
      }
    >
      <p className="bq-confirm">{text}</p>
    </Shell>
  );
}
