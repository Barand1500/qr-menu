import { useEffect, useRef, useState } from 'react';
import { Globe, Plug, MessageSquare, Building2, ImagePlus } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { Button, Input, PageHeader, Spinner, Textarea } from '@/components/ui';
import { TranslatableTextarea } from '@/components/TranslatableField';

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
  const [companyAbout, setCompanyAbout] = useState('');
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SettingsData>('/api/admin/settings')
      .then((d) => {
        setData(d);
        setCompanyName(d.restaurant.name);
        setCompanyAbout(d.settings.company_about || '');
        setMessages(Object.fromEntries(d.welcomeMessages.map((m) => [m.languageId, m.message])));
        setIntegrationEnabled(d.settings.integration_enabled === 'true');
        setOpenaiApiKey(d.settings.openai_api_key || '');
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
        body: JSON.stringify({ name: companyName, about: companyAbout }),
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
        body: JSON.stringify({
          enabled: integrationEnabled,
          openaiApiKey,
        }),
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

  const activeLanguages = [...data.languages.filter((l) => l.isActive)].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0
  );
  const trLanguage = data.languages.find((l) => l.code === 'tr');
  const trWelcomeMessage = trLanguage ? messages[trLanguage.id] || '' : '';

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title="Ayarlar"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5">
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

        <SettingsSection icon={Plug} title="Entegrasyon Ayarları" className="flex flex-col">
          <div className="flex flex-col h-full gap-5">
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

            <div
              className="rounded-2xl p-4 flex-1"
              style={{ background: 'var(--admin-input-bg)' }}
            >
              <Input
                label="OpenAI API Anahtarı"
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs admin-text-muted mt-3 leading-relaxed">
                Oto çeviri için ChatGPT anahtarınızı yapıştırın. Anahtar kaydedildiğinde çeviriler
                önce OpenAI ile yapılır; yoksa ücretsiz servisler kullanılır.
              </p>
            </div>
          </div>
        </SettingsSection>
      </div>

      <SettingsSection icon={MessageSquare} title="Karşılama Metinleri">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 float-field-stack">
          {activeLanguages.length === 0 ? (
            <p className="text-sm admin-text-muted col-span-full">
              Karşılama metni eklemek için en az bir dil aktif olmalı.
            </p>
          ) : (
            activeLanguages.map((lang) => (
              <TranslatableTextarea
                key={lang.id}
                label={`Karşılama metni (${lang.name})`}
                rows={4}
                sourceText={trWelcomeMessage}
                targetLang={lang.code}
                value={messages[lang.id] || ''}
                onChange={(val) => setMessages({ ...messages, [lang.id]: val })}
              />
            ))
          )}
        </div>
      </SettingsSection>

      <SettingsSection icon={Building2} title="Firma Ayarları">
        <div className="grid sm:grid-cols-2 gap-6 items-stretch">
          <div className="flex flex-col gap-4 min-h-[240px]">
            <Input
              label="Firma Adı"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Textarea
              label="Hakkında"
              value={companyAbout}
              onChange={(e) => setCompanyAbout(e.target.value)}
              className="flex-1 [&_.float-field]:h-full [&_.float-field__input]:min-h-[160px] [&_.float-field__input]:h-full [&_.float-field__input]:resize-none"
              rows={8}
            />
          </div>

          <div className="flex flex-col min-h-[240px]">
            <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
              Logo
            </p>
            <div
              className="flex-1 rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-[var(--admin-accent)] cursor-pointer flex flex-col items-center justify-center min-h-[240px]"
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
                  className="max-h-28 max-w-full object-contain mb-2"
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
