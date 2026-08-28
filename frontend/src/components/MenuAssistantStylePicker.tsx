import {
  MENU_ASSISTANT_STYLE_OPTIONS,
  type MenuAssistantStyle,
} from '@/lib/menuAssistantStyle';

interface MenuAssistantStylePickerProps {
  value: MenuAssistantStyle;
  saving?: boolean;
  onChange: (style: MenuAssistantStyle) => void;
}

export default function MenuAssistantStylePicker({
  value,
  saving = false,
  onChange,
}: MenuAssistantStylePickerProps) {
  return (
    <div className="assistant-style-picker">
      <p className="assistant-style-picker__label">Buton rengi</p>
      <div className="assistant-style-picker__grid" role="radiogroup" aria-label="Menü asistanı rengi">
        {MENU_ASSISTANT_STYLE_OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              className={`assistant-style-picker__opt${active ? ' is-active' : ''}`}
              onClick={() => onChange(opt.id)}
            >
              <span
                className={`assistant-style-picker__swatch assistant-style-picker__swatch--${opt.id}`}
                aria-hidden
              >
                <span className="assistant-style-picker__swatch-dot" />
              </span>
              <span className="assistant-style-picker__meta">
                <strong>{opt.label}</strong>
                <span>{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
