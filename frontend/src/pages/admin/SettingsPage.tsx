import { useEffect, useState } from 'react';
import { api, imageUrl } from '@/lib/api';
import { Button, Card, Input, PageHeader, Spinner } from '@/components/ui';

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

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SettingsData>('/api/admin/settings').then((d) => {
      setData(d);
      setCompanyName(d.restaurant.name);
      setMessages(Object.fromEntries(d.welcomeMessages.map((m) => [m.languageId, m.message])));
      setIntegrationEnabled(d.settings.integration_enabled === 'true');
    }).finally(() => setLoading(false));
  }, []);

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

  return (
    <div>
      <PageHeader
        title="Ayarlar"
        actions={<Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Dil Ayarları</h3>
          <div className="space-y-3">
            {data.languages.map((lang) => (
              <label key={lang.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm">{lang.name}</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Aktif</span>
                  <input
                    type="checkbox"
                    checked={lang.isActive}
                    onChange={() => toggleLanguage(lang.id)}
                    className="rounded text-indigo-600"
                  />
                </div>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Entegrasyon Ayarları</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={integrationEnabled}
              onChange={(e) => setIntegrationEnabled(e.target.checked)}
            />
            Entegrasyonu etkinleştir
          </label>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Karşılama Metinleri</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {data.languages.filter((l) => l.isActive).map((lang) => (
              <div key={lang.id}>
                <label className="block text-sm font-medium mb-1">{lang.name}</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm min-h-[80px]"
                  value={messages[lang.id] || ''}
                  onChange={(e) => setMessages({ ...messages, [lang.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Firma Ayarları</h3>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Firma Adı</label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Logo</label>
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            {data.restaurant.logoUrl && (
              <img
                src={imageUrl(data.restaurant.logoUrl)}
                alt="Logo"
                className="w-32 h-32 object-contain rounded-xl border border-slate-200 p-2"
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
