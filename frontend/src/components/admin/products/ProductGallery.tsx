import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';

export type GalleryPhoto = { id: string; src: string; pending?: boolean };
function Photo({
  photo,
  index,
  disabled,
  onRemove,
  hint,
}: {
  photo: GalleryPhoto;
  index: number;
  disabled?: boolean;
  onRemove: () => void;
  hint: string;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`pe-photo${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-photo-id={photo.id}
      data-admin-escape-owner={isDragging ? 'drag' : undefined}
    >
      <button
        type="button"
        className="pe-photo__drag"
        {...attributes}
        {...listeners}
        aria-describedby={hint}
        aria-label={`Görsel ${index + 1} sırasını değiştir`}
        disabled={disabled}
      >
        <img
          src={photo.src}
          alt={`Ürün görseli ${index + 1}`}
          draggable={false}
        />
      </button>
      <button
        type="button"
        className="pe-photo__delete"
        aria-label={`Görsel ${index + 1} sil`}
        title="Sil"
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
      <span className={`pe-photo__label${index === 0 ? ' is-cover' : ''}`}>
        {index === 0 ? 'Kapak' : String(index + 1).padStart(2, '0')}
        {photo.pending && ' · Yeni'}
      </span>
    </div>
  );
}
export default function ProductGallery({
  photos,
  disabled,
  onOrder,
  onRemove,
}: {
  photos: GalleryPhoto[];
  disabled?: boolean;
  onOrder: (ids: string[]) => void;
  onRemove: (photo: GalleryPhoto) => void;
}) {
  const hint = useId(),
    [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const picked = photos.find((photo) => photo.id === active);
  return (
    <>
      <p className="pe-help" id={hint}>
        Basılı tutup sürükleyin. İlk görsel kapaktır. Klavyede boşluk ile tutun,
        oklarla taşıyın.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActive(String(event.active.id))}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active, over }) => {
          setActive(null);
          if (disabled || !over || active.id === over.id) return;
          const from = photos.findIndex((photo) => photo.id === active.id),
            to = photos.findIndex((photo) => photo.id === over.id);
          if (from >= 0 && to >= 0)
            onOrder(arrayMove(photos, from, to).map((photo) => photo.id));
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Sıralamak için boşluğa basın. Oklarla taşıyın, boşluk ile bırakın veya Escape ile vazgeçin.',
          },
          announcements: {
            onDragStart: () => 'Görsel tutuldu.',
            onDragOver: ({ over }) =>
              over
                ? `Yeni sıra ${photos.findIndex((photo) => photo.id === over.id) + 1}.`
                : undefined,
            onDragEnd: () =>
              'Görsel bırakıldı. Sıralamayı yayınlamak için Kaydet’e basın.',
            onDragCancel: () => 'Taşıma iptal edildi.',
          },
        }}
      >
        <SortableContext
          items={photos.map((photo) => photo.id)}
          strategy={rectSortingStrategy}
        >
          <div className="pe-gallery">
            {photos.map((photo, index) => (
              <Photo
                key={photo.id}
                photo={photo}
                index={index}
                disabled={disabled}
                hint={hint}
                onRemove={() => onRemove(photo)}
              />
            ))}
          </div>
        </SortableContext>
        {createPortal(
          <DragOverlay zIndex={100}>
            {picked ? (
              <div className="pe-photo pe-photo--overlay">
                <img src={picked.src} alt="" />
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </>
  );
}
