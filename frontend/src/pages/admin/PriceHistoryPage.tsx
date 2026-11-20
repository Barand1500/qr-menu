import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeading } from '@/components/ui';
import PriceHistoryExplorer from '@/components/admin/products/PriceHistoryExplorer';
import { adminPath } from '@/lib/adminPath';
import '@/components/admin/products/price-history.css';

/** Ürün bazlı fiyat geçmişi: tam ekran. Ürünler sayfasındaki fiyat geçmişi penceresinden açılır. */
export default function PriceHistoryPage() {
  const navigate = useNavigate();
  return (
    <section className="aphp" aria-label="Fiyat geçmişi">
      <header className="aphp-head">
        <button type="button" className="aphp-back" onClick={() => navigate(adminPath('products'))}>
          <ArrowLeft size={18} aria-hidden="true" /> Ürünlere dön
        </button>
        <PageHeading title="Fiyat geçmişi" subtitle="Ürünlerin fiyatı zaman içinde nasıl değişti?" />
      </header>
      <PriceHistoryExplorer variant="page" />
    </section>
  );
}
