import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';
import type { TopItem } from '@/lib/demoData';

export type DashboardPanelId =
  | 'menu-duzenle'
  | 'aktif-gruplar'
  | 'pasif-gruplar'
  | 'basarili-urunler'
  | 'hatali-urunler'
  | 'goruntuleme'
  | 'tekil-ziyaretci';

export const PANEL_TITLES: Record<DashboardPanelId, string> = {
  'menu-duzenle': 'Menü Düzenleme',
  'aktif-gruplar': 'Aktif Gruplar',
  'pasif-gruplar': 'Pasif Gruplar',
  'basarili-urunler': 'Başarılı Ürünler',
  'hatali-urunler': 'Hatalı Ürünler',
  goruntuleme: 'Görüntüleme Detayı',
  'tekil-ziyaretci': 'Tekil Ziyaretçi',
};

export const PANEL_SUBTITLES: Record<DashboardPanelId, string> = {
  'menu-duzenle': 'Grupları sürükleyerek menü sırasını değiştirin',
  'aktif-gruplar': 'Menüde görünen grupları sürükleyip sıralayın',
  'pasif-gruplar': 'Pasif grupları menüye ekleyin',
  'basarili-urunler': 'Geçerli ürünlerin listesi',
  'hatali-urunler': 'Eksik bilgili ürünleri düzeltin',
  goruntuleme: 'Bugünkü görüntüleme istatistikleri',
  'tekil-ziyaretci': 'Benzersiz ziyaretçi bilgisi',
};

interface Group {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface Product {
  id: number;
  name: string;
  groupName: string;
  price: number;
  isValid: boolean;
  isActive: boolean;
}

function SortableGroupRow({
  group,
  onRemove,
}: {
  group: Group;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `g-${group.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        background: 'var(--admin-input-bg)',
        borderColor: 'var(--admin-card-border)',
      }}
      className="flex items-center gap-3 p-3.5 rounded-2xl border"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-[var(--admin-text-subtle)]"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <span className="flex-1 text-sm font-semibold text-[var(--admin-text)] truncate">
        {group.name}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-2 rounded-xl hover:bg-red-500/10 text-red-500"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function PassiveGroupRow({ group, onAdd }: { group: Group; onAdd: () => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3.5 rounded-2xl border"
      style={{
        background: 'var(--admin-card)',
        borderColor: 'var(--admin-card-border)',
      }}
    >
      <span className="flex-1 text-sm text-[var(--admin-text-muted)] truncate">{group.name}</span>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent-text)' }}
      >
        <Plus className="w-3.5 h-3.5" />
        Ekle
      </button>
    </div>
  );
}

export default function DashboardBottomPanel({
  panel,
  topGroups,
  topProducts,
  viewsTotal,
  viewsUnique,
}: {
  panel: DashboardPanelId;
  topGroups: TopItem[];
  topProducts: TopItem[];
  viewsTotal: number;
  viewsUnique: number;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragItem, setDragItem] = useState<Group | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadGroups = useCallback(async () => {
    const res = await api<{ data: Group[] }>('/api/admin/groups?limit=100');
    setGroups([...res.data].sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  const loadProducts = useCallback(async () => {
    const res = await api<{ data: Product[] }>('/api/admin/products?limit=100');
    setProducts(res.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    const needsGroups = [
      'menu-duzenle',
      'aktif-gruplar',
      'pasif-gruplar',
    ].includes(panel);
    const needsProducts = ['basarili-urunler', 'hatali-urunler'].includes(panel);

    Promise.all([
      needsGroups ? loadGroups() : Promise.resolve(),
      needsProducts ? loadProducts() : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [panel, loadGroups, loadProducts]);

  const activeGroups = groups.filter((g) => g.isActive);
  const passiveGroups = groups.filter((g) => !g.isActive);
  const validProducts = products.filter((p) => p.isValid);
  const invalidProducts = products.filter((p) => !p.isValid);

  async function persistOrder(list: Group[]) {
    setSaving(true);
    try {
      await api('/api/admin/groups/reorder/bulk', {
        method: 'PUT',
        body: JSON.stringify({
          items: list.map((g, i) => ({ id: g.id, sortOrder: i + 1 })),
        }),
      });
      await loadGroups();
    } finally {
      setSaving(false);
    }
  }

  async function toggleGroup(id: number) {
    setSaving(true);
    try {
      await api(`/api/admin/groups/${id}/toggle`, { method: 'PATCH' });
      await loadGroups();
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(e: DragStartEvent) {
    const id = Number(String(e.active.id).replace('g-', ''));
    const g = activeGroups.find((x) => x.id === id);
    if (g) setDragItem(g);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDragItem(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = activeGroups.findIndex((g) => `g-${g.id}` === active.id);
    const newIndex = activeGroups.findIndex((g) => `g-${g.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(activeGroups, oldIndex, newIndex);
    setGroups((prev) => {
      const passive = prev.filter((g) => !g.isActive);
      return [...reordered, ...passive];
    });
    await persistOrder(reordered);
  }

  if (loading) return <Spinner />;

  if (saving) {
    return (
      <p className="text-center text-sm admin-text-muted py-4 animate-pulse">Kaydediliyor...</p>
    );
  }

  if (panel === 'menu-duzenle' || panel === 'aktif-gruplar') {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeGroups.map((g) => `g-${g.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {activeGroups.length === 0 ? (
              <p className="text-sm admin-text-subtle text-center py-8">
                Aktif grup yok. Pasif Gruplar sekmesinden ekleyin.
              </p>
            ) : (
              activeGroups.map((g) => (
                <SortableGroupRow
                  key={g.id}
                  group={g}
                  onRemove={panel === 'menu-duzenle' ? () => toggleGroup(g.id) : undefined}
                />
              ))
            )}
          </div>
        </SortableContext>
        <DragOverlay>
          {dragItem && (
            <div
              className="p-3.5 rounded-2xl shadow-xl text-sm font-semibold"
              style={{ background: 'var(--admin-card)', color: 'var(--admin-text)' }}
            >
              {dragItem.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    );
  }

  if (panel === 'pasif-gruplar') {
    return (
      <div className="space-y-2">
        {passiveGroups.length === 0 ? (
          <p className="text-sm admin-text-subtle text-center py-8">
            Tüm gruplar menüde aktif.
          </p>
        ) : (
          passiveGroups.map((g) => (
            <PassiveGroupRow key={g.id} group={g} onAdd={() => toggleGroup(g.id)} />
          ))
        )}
      </div>
    );
  }

  if (panel === 'basarili-urunler') {
    return (
      <ProductList
        items={validProducts}
        empty="Başarılı ürün bulunamadı"
      />
    );
  }

  if (panel === 'hatali-urunler') {
    return (
      <ProductList
        items={invalidProducts}
        empty="Hatalı ürün yok — harika!"
        highlightInvalid
      />
    );
  }

  if (panel === 'goruntuleme') {
    return (
      <div className="space-y-4">
        <div
          className="p-5 rounded-2xl text-center"
          style={{ background: 'var(--admin-accent-soft)' }}
        >
          <p className="text-4xl font-bold admin-accent">{viewsTotal}</p>
          <p className="text-sm admin-text-muted mt-1">Bugünkü toplam görüntüleme</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <RankList title="En çok görüntülenen gruplar" items={topGroups} />
          <RankList title="En çok görüntülenen ürünler" items={topProducts} />
        </div>
      </div>
    );
  }

  if (panel === 'tekil-ziyaretci') {
    return (
      <div className="space-y-4">
        <div
          className="p-5 rounded-2xl text-center"
          style={{ background: 'var(--admin-accent-soft)' }}
        >
          <p className="text-4xl font-bold admin-accent">{viewsUnique}</p>
          <p className="text-sm admin-text-muted mt-1">Bugünkü tekil ziyaretçi</p>
        </div>
        <p className="text-sm admin-text-muted leading-relaxed">
          Tekil ziyaretçi, aynı gün menüyü birden fazla kez açsa bile bir kez sayılır.
          Oturum kimliği tarayıcıda saklanır.
        </p>
      </div>
    );
  }

  return null;
}

function ProductList({
  items,
  empty,
  highlightInvalid,
}: {
  items: Product[];
  empty: string;
  highlightInvalid?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm admin-text-subtle text-center py-8">{empty}</p>;
  }
  return (
    <div className="space-y-2 max-h-[40vh] overflow-y-auto admin-scroll">
      {items.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between p-3.5 rounded-2xl border"
          style={{
            background: 'var(--admin-input-bg)',
            borderColor: highlightInvalid ? '#ef444440' : 'var(--admin-card-border)',
          }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)] truncate">{p.name}</p>
            <p className="text-xs admin-text-subtle">{p.groupName}</p>
          </div>
          <span className="text-sm font-medium admin-accent shrink-0 ml-2">
            {p.price.toFixed(2)} ₺
          </span>
        </div>
      ))}
    </div>
  );
}

function RankList({ title, items }: { title: string; items: TopItem[] }) {
  return (
    <div
      className="p-4 rounded-2xl border"
      style={{ borderColor: 'var(--admin-card-border)' }}
    >
      <p className="text-xs font-semibold admin-text-muted uppercase mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs admin-text-subtle">Veri yok</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, i) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-[var(--admin-text)] truncate mr-2">
                {i + 1}. {item.name}
              </span>
              <span className="font-semibold admin-accent shrink-0">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
