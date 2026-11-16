import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';
import { adminPath } from '@/lib/adminPath';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';

interface ProductItem {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  isActive: boolean;
}
export default function GroupProductsModal({
  open,
  groupId,
  groupName,
  onClose,
}: {
  open: boolean;
  groupId: number | null;
  groupName: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductItem[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || !groupId) return;
    const abort = new AbortController();
    let cancelled = false;
    setLoading(true);
    setProducts([]);
    setError('');
    void (async () => {
      try {
        const rows: ProductItem[] = [];
        for (let page = 1; ; page++) {
          const result = await api<{
            data: ProductItem[];
            pagination?: { total: number };
          }>(`/api/admin/products?groupId=${groupId}&limit=100&page=${page}`, {
            signal: abort.signal,
          });
          rows.push(...result.data);
          if (
            !result.data.length ||
            rows.length >= (result.pagination?.total ?? rows.length)
          )
            break;
        }
        if (!cancelled) setProducts(rows);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Ürünler yüklenemedi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [open, groupId, retry]);
  function go(path: string) {
    onClose();
    navigate(path);
  }
  return (
    <GroupsDialog
      open={open && groupId !== null}
      title={groupName}
      subtitle="Bu grubun ürünleri"
      onClose={onClose}
    >
      {loading ? (
        <Spinner />
      ) : error ? (
        <div role="alert" className="ag-empty">
          <p>{error}</p>
          <Button onClick={() => setRetry((v) => v + 1)}>Tekrar dene</Button>
        </div>
      ) : (
        <>
          <div className="ag-product-tools">
            <span>{products.length} ürün</span>
            <button
              onClick={() =>
                go(`${adminPath('products')}?new=1&groupId=${groupId}`)
              }
            >
              <Plus size={14} className="inline mr-1" />
              Ürün ekle
            </button>
          </div>
          {!products.length && (
            <p className="ag-delete-copy">
              Bu grupta henüz ürün yok. İlk ürünü ekleyerek başlayabilirsiniz.
            </p>
          )}
          <ul className="ag-product-list">
            {products.map((product) => (
              <li key={product.id}>
                <button
                  onClick={() =>
                    go(`${adminPath('products')}?edit=${product.id}`)
                  }
                >
                  {product.imageUrl && (
                    <img src={imageUrl(product.imageUrl)} alt="" />
                  )}
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {formatMoney(product.price, product.currency)}
                      {!product.isActive && ' · Gizli'}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </GroupsDialog>
  );
}
