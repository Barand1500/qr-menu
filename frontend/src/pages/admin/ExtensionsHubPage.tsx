import { Link } from 'react-router-dom';
import { QrCode, Sparkles, LayoutTemplate, ChevronRight } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

const LINKS = [
  {
    to: '/admin/extensions/welcome',
    title: 'Karşılama ekranları',
    desc: 'Sinematik, Neon Gece ve gelecek karşılama temaları.',
    icon: Sparkles,
  },
  {
    to: '/admin/extensions/menu',
    title: 'Menü ekranları',
    desc: 'Canlı, Lüks ve gelecek menü görünümleri.',
    icon: LayoutTemplate,
  },
  {
    to: '/admin/extensions/qr',
    title: 'QR',
    desc: 'Renkli, logolu, masa ve kampanya QR paketleri.',
    icon: QrCode,
  },
];

export default function ExtensionsHubPage() {
  return (
    <div>
      <PageHeader title="Eklentiler" />
      <p className="text-sm admin-text-muted -mt-4 mb-6 max-w-2xl">
        Temalar ve QR paketleri burada. Satın Al yakında; şimdilik Kod Gir ile açılır. Açılanlar
        Başlangıç Ayarları ve Barkod sayfasında kullanılır.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="block group">
              <Card className="p-5 h-full transition hover:border-[var(--admin-accent)]">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--admin-accent-soft)' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-[var(--admin-text)]">{item.title}</h3>
                      <ChevronRight className="w-4 h-4 admin-text-muted group-hover:text-[var(--admin-accent)]" />
                    </div>
                    <p className="text-sm admin-text-muted mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
