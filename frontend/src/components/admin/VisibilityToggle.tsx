import './visibility-toggle.css';

/**
 * "Menüde göster / gizle" anahtarı. Çerçeveli hap + kaydıraç: tıklanabilir olduğu açıkça belli olur.
 * Durum yalnızca renkle değil, metinle de söylenir.
 */
export default function VisibilityToggle({
  checked,
  onToggle,
  label,
  onText = 'Açık',
  offText = 'Gizli',
  disabled,
  className = '',
}: {
  checked: boolean;
  onToggle: () => void;
  /** Ekran okuyucu adı, ör. "Ürün adı menüde görünür" */
  label: string;
  onText?: string;
  offText?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? 'Kapatmak için dokunun' : 'Açmak için dokunun'}
      disabled={disabled}
      className={`vt${checked ? ' is-on' : ''} ${className}`.trim()}
      onClick={onToggle}
    >
      <span className="vt__track" aria-hidden="true">
        <span className="vt__knob" />
      </span>
      <span className="vt__text">{checked ? onText : offText}</span>
    </button>
  );
}
