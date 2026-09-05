import SiparisProductCard from '@/components/public/siparis/SiparisProductCard';

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
};

export default function SiparisProductList({
  products,
  groupName,
}: {
  products: Product[];
  groupName: string;
}) {
  return (
    <div className="siparis-list">
      <header className="siparis-list__head">
        <h1>{groupName}</h1>
      </header>
      <div className="siparis-grid siparis-grid--list">
        {products.map((p) => (
          <SiparisProductCard
            key={p.id}
            product={{
              productId: p.id,
              name: p.name,
              price: p.price,
              currency: p.currency,
              imageUrl: p.imageUrl,
              calories: p.calories ?? null,
              description: p.description,
            }}
          />
        ))}
      </div>
    </div>
  );
}
