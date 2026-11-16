import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import {
  ChevronDown,
  GripVertical,
  ImagePlus,
  MoreHorizontal,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import type { AdminGroup } from './types';

export default function GroupListRow({
  group,
  childrenNames,
  expanded,
  onExpand,
  onActions,
  onRename,
  onToggle,
  onProducts,
  onImage,
  busy,
  sortable,
  contextOnly = false,
}: {
  group: AdminGroup;
  childrenNames?: string[];
  expanded?: boolean;
  onExpand?: () => void;
  onActions: (group: AdminGroup, event: MouseEvent<HTMLElement>) => void;
  onRename: (group: AdminGroup, name: string) => Promise<boolean>;
  onToggle: (group: AdminGroup) => void;
  onProducts: (group: AdminGroup) => void;
  onImage: (group: AdminGroup, file: File) => void;
  busy: boolean;
  sortable: boolean;
  contextOnly?: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(group.name);
  const [broken, setBroken] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    file = useRef<HTMLInputElement>(null);
  const submitBusy = useRef(false);
  const hintId = useId();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: group.id, disabled: !sortable || busy || renaming });
  useEffect(() => setBroken(false), [group.imageUrl]);
  useEffect(() => {
    if (renaming) {
      input.current?.focus();
      input.current?.select();
    }
  }, [renaming]);
  const cancel = () => {
    if (!submitBusy.current) {
      setValue(group.name);
      setRenaming(false);
    }
  };
  async function commit() {
    if (submitBusy.current) return;
    if (!value.trim()) {
      input.current?.focus();
      return;
    }
    if (value.trim() === group.name) {
      setRenaming(false);
      return;
    }
    submitBusy.current = true;
    try {
      if (await onRename(group, value.trim())) setRenaming(false);
    } finally {
      submitBusy.current = false;
    }
  }
  return (
    <div
      ref={setNodeRef}
      className={`ag-row${group.isSubGroup ? ' ag-row--sub' : ''}${!group.isActive ? ' is-hidden' : ''}${isDragging ? ' is-dragging' : ''}${isOver && !isDragging ? ' is-over' : ''}${contextOnly ? ' is-context' : ''}`}
      data-group-id={group.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onContextMenu={(event) => {
        if (!(event.target as HTMLElement).closest('input'))
          onActions(group, event);
      }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="ag-drag"
        aria-label={`${group.name} grubunu sırala`}
        disabled={!sortable || busy || contextOnly}
        title={
          sortable
            ? 'Sürükleyerek sırala; klavyede boşluk ve ok tuşları'
            : 'Sıralamak için filtreleri temizleyin'
        }
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <button
        type="button"
        className="ag-photo"
        disabled={busy || contextOnly}
        aria-label={`${group.name} görselini değiştir`}
        onClick={() => file.current?.click()}
      >
        {group.imageUrl && !broken ? (
          <img
            src={imageUrl(group.imageUrl)}
            alt=""
            onError={() => setBroken(true)}
          />
        ) : (
          <MenuMediaPlaceholder kind="group" size="sm" label={group.name} />
        )}
        <span className="ag-photo__edit">
          <ImagePlus size={16} />
        </span>
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        aria-label={`${group.name} için görsel seç`}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (picked) onImage(group, picked);
        }}
      />
      <div className="ag-row__identity">
        {renaming ? (
          <form
            className="ag-rename"
            onSubmit={(e) => {
              e.preventDefault();
              void commit();
            }}
          >
            <input
              ref={input}
              aria-label={`${group.name} yeni adı`}
              value={value}
              maxLength={200}
              disabled={busy}
              enterKeyHint="done"
              aria-describedby={hintId}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  cancel();
                }
              }}
            />
            <small id={hintId} className="ag-rename__hint">
              {busy ? 'Kaydediliyor…' : 'Enter ile kaydet · Esc ile vazgeç'}
            </small>
          </form>
        ) : (
          <button
            type="button"
            className="ag-name"
            title="Adı düzenle"
            disabled={busy || contextOnly}
            onClick={() => {
              setValue(group.name);
              setRenaming(true);
            }}
          >
            {group.name}
          </button>
        )}
        {group.isSubGroup ? (
          <span className="ag-parent">{group.parentName || 'Alt grup'}</span>
        ) : (
          Boolean(childrenNames?.length) && (
            <button
              type="button"
              className="ag-children-summary"
              aria-expanded={expanded}
              aria-label={`${group.name} alt gruplarını ${expanded ? 'kapat' : 'aç'}`}
              onClick={onExpand}
            >
              <ChevronDown
                size={14}
                className={expanded ? 'is-expanded' : ''}
              />
              <span>
                {expanded
                  ? `${childrenNames!.length} alt grup`
                  : childrenNames!.join(' · ')}
              </span>
            </button>
          )
        )}
      </div>
      <button
        type="button"
        className="ag-products"
        disabled={busy || contextOnly}
        aria-label={`${group.name}: ${group.productCount} ürünü gör`}
        onClick={() => onProducts(group)}
      >
        <b>{group.productCount}</b>
        <span>ürün</span>
      </button>
      <button
        type="button"
        className={`ag-visibility${group.isActive ? ' is-on' : ''}`}
        role="switch"
        aria-checked={group.isActive}
        aria-label={`${group.name} menüde görünür`}
        disabled={busy || contextOnly}
        onClick={() => onToggle(group)}
      >
        <i />
        <span>{group.isActive ? 'Açık' : 'Gizli'}</span>
      </button>
      <button
        type="button"
        className="ag-icon ag-more"
        aria-label={`${group.name} işlemleri`}
        disabled={busy || contextOnly}
        onClick={(e) => onActions(group, e)}
      >
        <MoreHorizontal size={21} />
      </button>
    </div>
  );
}
