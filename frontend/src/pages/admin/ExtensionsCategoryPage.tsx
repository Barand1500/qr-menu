import { useMemo, useState } from 'react';
import { Check, KeyRound, Lock, ShoppingBag, QrCode, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, PageHeader, Spinner } from '@/components/ui';
import UnlockAddonModal from '@/components/UnlockAddonModal';
import { useAddons } from '@/hooks/useAddons';
import type { AddonCategory, AddonProduct } from '@/lib/addons';

interface ExtensionsCategoryPageProps {
  category: AddonCategory;
  title: string;
  subtitle: string;
}

export default function ExtensionsCategoryPage({
  category,
  title,
  subtitle,
}: ExtensionsCategoryPageProps) {
  const { products, loading, unlock } = useAddons();
  const [selected, setSelected] = useState<AddonProduct | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const list = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category]
  );

  async function handleUnlock(code: string) {
    if (!selected) return;
    setUnlocking(true);
    try {
      await unlock(selected.id, code);
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title={title} />
      <p className="text-sm admin-text-muted -mt-4 mb-6 max-w-2xl">{subtitle}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((product) => {
          const owned = Boolean(product.owned);
          return (
            <Card
              key={product.id}
              className={`theme-pick-card overflow-hidden ${owned ? 'theme-pick-card--active' : ''}`}
            >
              <div className={`theme-preview ${product.previewClass || 'theme-preview--sade'}`}>
                <div className="theme-preview__shine" />
                {owned ? (
                  <div className="theme-preview__active">
                    <Check className="w-4 h-4" />
                    Satın alındı
                  </div>
                ) : (
                  <div className="theme-preview__lock">
                    <Lock className="w-5 h-5" />
                    <span>Kilitli</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-[var(--admin-text)]">{product.name}</h3>
                <p className="text-sm admin-text-muted mt-1.5 leading-relaxed">
                  {product.description}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button type="button" variant="secondary" className="w-full" disabled>
                    <ShoppingBag className="w-4 h-4" />
                    Satın Al
                  </Button>
                  {owned ? (
                    category === 'qr' ? (
                      <Link to="/admin/barcode" className="w-full">
                        <Button type="button" className="w-full">
                          <QrCode className="w-4 h-4" />
                          Barkod’a git
                        </Button>
                      </Link>
                    ) : (
                      <Link
                        to={
                          category === 'welcome'
                            ? '/admin/startup/welcome'
                            : '/admin/startup/menu'
                        }
                        className="w-full"
                      >
                        <Button type="button" className="w-full">
                          <Sparkles className="w-4 h-4" />
                          Temalarda kullan
                        </Button>
                      </Link>
                    )
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setSelected(product)}
                    >
                      <KeyRound className="w-4 h-4" />
                      Kod Gir
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <UnlockAddonModal
        open={Boolean(selected)}
        productName={selected?.name || ''}
        unlocking={unlocking}
        onClose={() => setSelected(null)}
        onUnlock={handleUnlock}
      />
    </div>
  );
}
