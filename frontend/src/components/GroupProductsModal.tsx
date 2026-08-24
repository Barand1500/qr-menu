import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Package, ChevronRight } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { Badge, Button, Spinner } from '@/components/ui';

interface ProductItem {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  isActive: boolean;
}

interface GroupProductsModalProps {
  open: boolean;
  groupId: number | null;
  groupName: string;
  onClose: () => void;
}

export default function GroupProductsModal({
  open,
  groupId,
  groupName,
  onClose,
}: GroupProductsModalProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !groupId) return;
    setLoading(true);
    api<{ data: ProductItem[] }>(`/api/admin/products?groupId=${groupId}&limit=100`)
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [open, groupId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !groupId) return null;

  function goEdit(productId: number) {
    onClose();
    navigate(`/admin/products?edit=${productId}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 pt-6 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)' }}
              >
                <Package className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--admin-text)] truncate">{groupName}</h2>
                <p className="text-sm admin-text-muted mt-0.5">
                  {loading ? 'Yükleniyor...' : `${products.length} ürün`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] admin-text-muted transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto admin-scroll px-6 py-4">
          {loading ? (
            <Spinner />
          ) : products.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-10 h-10 mx-auto admin-text-subtle mb-3" />
              <p className="text-sm admin-text-muted">Bu grupta henüz ürün yok</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {products.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => goEdit(product.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition hover:bg-[var(--admin-accent-soft)]/60 group"
                    style={{ background: 'var(--admin-input-bg)' }}
                  >
                    {product.imageUrl ? (
                      <img
                        src={imageUrl(product.imageUrl)}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl shrink-0"
                        style={{ background: 'var(--admin-accent-soft)' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--admin-text)] truncate">{product.name}</p>
                      <p className="text-sm admin-text-muted">{formatMoney(product.price, product.currency)}</p>
                    </div>
                    <Badge active={product.isActive} />
                    <ChevronRight className="w-4 h-4 admin-text-subtle shrink-0 group-hover:text-[var(--admin-accent)] transition" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 shrink-0">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
