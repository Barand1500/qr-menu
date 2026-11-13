import { useRef, type ElementType } from 'react';
import { imageUrl } from '@/lib/api';
import { type SofraConfig, type SofraTextField } from '@/lib/sofra';

export interface SofraEditing {
  onTextEdit?: (field: SofraTextField, value: string) => void;
  onImageEdit?: (field: 'welcomeImage' | 'menuImage') => void;
  onBrandEdit?: (value: string) => void;
}
export interface SofraRestaurant {
  name: string;
  logoUrl?: string | null;
}
export interface SofraGroup {
  id: number;
  name: string;
  imageUrl?: string | null;
}
export interface SofraProduct {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  currency?: { code?: string | null; symbol?: string | null } | null;
  soldOut?: boolean;
  hasOptions?: boolean;
  calories?: number | null;
}
function SofraInlineText({
  as: Tag = 'span',
  field,
  value,
  onChange,
  className,
}: {
  as?: ElementType;
  field: string;
  value: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const focused = useRef(false);
  const shown = useRef(value);
  // Keep the editable DOM stable while typing so React never moves the caret.
  if (!focused.current) shown.current = value;
  const read = (node: HTMLElement) =>
    (node.innerText || '').slice(
      0,
      field === 'enterLabel' ? 60 : field === 'brandName' ? 100 : 400
    );
  return (
    <Tag
      className={className}
      contentEditable={onChange ? 'plaintext-only' : undefined}
      suppressContentEditableWarning={Boolean(onChange)}
      role={onChange ? 'textbox' : undefined}
      tabIndex={onChange ? 0 : undefined}
      aria-label={onChange ? `${field} metnini düzenle` : undefined}
      data-sofra-editable={onChange ? field : undefined}
      onFocus={() => {
        focused.current = true;
      }}
      onInput={
        onChange ? (e: React.FormEvent<HTMLElement>) => onChange(read(e.currentTarget)) : undefined
      }
      onBlur={
        onChange
          ? (e: React.FocusEvent<HTMLElement>) => {
              focused.current = false;
              onChange(read(e.currentTarget));
            }
          : undefined
      }
    >
      {shown.current}
    </Tag>
  );
}
export function SofraText({
  as,
  field,
  value,
  onTextEdit,
  className,
}: {
  as?: ElementType;
  field: SofraTextField;
  value: string;
  className?: string;
} & Pick<SofraEditing, 'onTextEdit'>) {
  return (
    <SofraInlineText
      as={as}
      field={field}
      value={value}
      className={className}
      onChange={onTextEdit ? (value) => onTextEdit(field, value) : undefined}
    />
  );
}
export function SofraBrand({
  restaurant,
  config,
  onBrandEdit,
}: {
  restaurant: SofraRestaurant;
  config: SofraConfig;
  onBrandEdit?: (value: string) => void;
}) {
  return (
    <span className="sofra-brand">
      {restaurant.logoUrl && <img src={imageUrl(restaurant.logoUrl)} alt="" />}
      <SofraInlineText
        field="brandName"
        value={config.brandName || restaurant.name}
        onChange={onBrandEdit}
      />
    </span>
  );
}
export function SofraImage({
  src,
  alt,
  field,
  onImageEdit,
  className,
}: {
  src: string;
  alt: string;
  field: 'welcomeImage' | 'menuImage';
  className: string;
} & Pick<SofraEditing, 'onImageEdit'>) {
  const photo = (
    <img
      src={src.startsWith('blob:') ? src : imageUrl(src)}
      alt={alt}
      fetchPriority="high"
      onLoad={(e) => {
        e.currentTarget.style.visibility = '';
      }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
  return onImageEdit ? (
    <button
      type="button"
      className={`${className} sofra-photo-edit`}
      aria-label="Fotoğrafı değiştir"
      onClick={() => onImageEdit(field)}
    >
      {photo}
      <span>Fotoğrafı değiştir</span>
    </button>
  ) : (
    <div className={className}>{photo}</div>
  );
}
