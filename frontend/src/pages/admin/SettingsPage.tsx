import { useEffect, useRef, useState } from 'react';
import { Globe, Plug, MessageSquare, Building2, ImagePlus } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { Button, Input, PageHeader, Spinner, Textarea } from '@/components/ui';

interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface SettingsData {
  restaurant: { id: number; name: string; logoUrl?: string | null };
  languages: Language[];
  welcomeMessages: { languageId: number; languageCode: string; message: string }[];
  settings: Record<string, string>;
}

function SettingsSection({
  icon: Icon,
  title,
  children,
  className = '',
}: {
  icon: typeof Globe;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-card overflow-hidden flex flex-col ${className}`}>
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 shrink-0"
        style={{
          background: 'var(--admin-input-bg)',
          borderBottom: '1px solid var(--admin-card-border)',
        }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--admin-text)]">
          {title}
        </h3>
      </div>
      <div className="p-5 flex-1">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SettingsData>('/api/admin/settings')
      .then((d) => {
        setData(d);
        setCompanyName(d.restaurant.name);
        setMessages(Object.fromEntries(d.welcomeMessages.map((m) => [m.languageId, m.message])));
        setIntegrationEnabled(d.settings.integration_enabled === 'true');
        setLogoPreview(d.restaurant.logoUrl ? imageUrl(d.restaurant.logoUrl) : null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function saveLanguages() {
    if (!data) return;
    await api('/api/admin/settings/languages', {
      method: 'PUT',
      body: JSON.stringify({
        languages: data.languages.map((l) => ({ id: l.id, isActive: l.isActive })),
      }),
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api('/api/admin/settings/company', {
        method: 'PUT',
        body: JSON.stringify({ name: companyName }),
      });
      await api('/api/admin/settings/welcome-messages', {
        method: 'PUT',
        body: JSON.stringify({
          messages: Object.entries(messages).map(([languageId, message]) => ({
            languageId: Number(languageId),
            message,
          })),
        }),
      });
      await saveLanguages();
      await api('/api/admin/settings/integration', {
        method: 'PUT',
        body: JSON.stringify({ enabled: integrationEnabled }),
      });
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await fetch('/api/admin/settings/logo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd,
        });
      }
      alert('Ayarlar kaydedildi');
    } finally {
      setSaving(false);
    }
  }

  function toggleLanguage(id: number) {
    if (!data) return;
    setData({
      ...data,
      languages: data.languages.map((l) =>
        l.id === id ? { ...l, isActive: !l.isActive } : l
      ),
    });
  }

  if (loading || !data) return <Spinner />;

  const activeLanguages = data.languages.filter((l) => l.isActive);

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title="Ayarlar"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        }
      />

      <div className="grid md:grid-cols-2 gap-5">
        <SettingsSection icon={Globe} title="Dil Ayarları">
          <div className="space-y-1">
            {data.languages.map((lang) => (
              <label
                key={lang.id}
                className="flex items-center justify-between py-3 px-3 rounded-xl cursor-pointer transition hover:bg-[var(--admin-accent-soft)]/30"
                style={{ borderBottom: '1px solid var(--admin-card-border)' }}
              >
                <span className="text-sm font-medium text-[var(--admin-text)]">{lang.name}</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs admin-text-muted">Aktif</span>
                  <input
                    type="checkbox"
                    checked={lang.isActive}
                    onChange={() => toggleLanguage(lang.id)}
                    className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                  />
                </div>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection icon={Plug} title="Entegrasyon Ayarları">
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-[var(--admin-accent-soft)]/30 transition">
            <input
              type="checkbox"
              checked={integrationEnabled}
              onChange={(e) => setIntegrationEnabled(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded accent-[var(--admin-accent)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--admin-text)]">
                Entegrasyonu etkinleştir
              </p>
              <p className="text-xs admin-text-muted mt-1">
                Harici POS veya sipariş sistemleri ile bağlantı
              </p>
            </div>
          </label>
        </SettingsSection>
      </div>

      <SettingsSection icon={MessageSquare} title="Karşılama Metinleri">
        <div className="grid sm:grid-cols-2 gap-4 float-field-stack">
          {activeLanguages.length === 0 ? (
            <p className="text-sm admin-text-muted col-span-2">
              Karşılama metni eklemek için en az bir dil aktif olmalı.
            </p>
          ) : (
            activeLanguages.map((lang) => (
              <Textarea
                key={lang.id}
                label={`Karşılama metni (${lang.name})`}
                rows={4}
                value={messages[lang.id] || ''}
                onChange={(e) => setMessages({ ...messages, [lang.id]: e.target.value })}
              />
            ))
          )}
        </div>
      </SettingsSection>

      <SettingsSection icon={Building2} title="Firma Ayarları">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="float-field-stack">
            <Input
              label="Firma Adı"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
              Logo
            </p>
            <div
              className="rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-[var(--admin-accent)] cursor-pointer min-h-[160px] flex flex-col items-center justify-center"
              style={{ borderColor: 'var(--admin-card-border)' }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo önizleme"
                  className="max-h-24 max-w-full object-contain mb-2"
                />
              ) : (
                <ImagePlus
                  className="w-10 h-10 mb-2"
                  style={{ color: 'var(--admin-accent)' }}
                />
              )}
              <p className="text-sm font-medium text-[var(--admin-text)]">
                Logo yüklemek için tıklayın
              </p>
              <p className="text-xs admin-text-subtle mt-1">PNG, JPG — şeffaf arka plan önerilir</p>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
