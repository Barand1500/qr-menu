import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Lock, Megaphone, Printer, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAddons } from '@/hooks/useAddons';
import { PageHeading, Spinner } from '@/components/ui';
import { api, imageUrl } from '@/lib/api';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import CampaignMenuModal from '@/components/CampaignMenuModal';
import {
  ColorControl,
  DesignDock,
  Field,
  FrameControl,
  LogoControl,
  TemplateControl,
  TextControls,
} from '@/components/admin/barcode/DesignControls';
import {
  CampaignDialog,
  ConfirmDialog,
  GroupDialog,
  type GroupForm,
} from '@/components/admin/barcode/Dialogs';
import PrintDialog, {
  type PrintSettings,
} from '@/components/admin/barcode/PrintDialog';
import PrintSheet, {
  type PrintJob,
} from '@/components/admin/barcode/PrintSheet';
import Stage from '@/components/admin/barcode/Stage';
import {
  CampaignTargets,
  TablesTargets,
  Upsell,
} from '@/components/admin/barcode/Targets';
import {
  DEFAULT_DESIGN,
  DESIGN_KEY,
  GROUPS_KEY,
  defaultTableStyle,
  isFrame,
  loadDesign,
  loadTableGroups,
  normalizePrefix,
  readTableStyle,
  resolveColor,
  slugify,
  tableCode,
  type CampaignRow,
  type CardSpec,
  type Design,
  type GroupStyles,
  type Mode,
  type TableGroup,
  type TableStyle,
} from '@/components/admin/barcode/qr';
import '@/components/admin/barcode/barcode.css';

const MODES = [
  {
    id: 'classic',
    label: 'QR Menü',
    short: 'Menü',
    Icon: QrCode,
    premium: false,
  },
  {
    id: 'tables',
    label: 'Masalar',
    short: 'Masalar',
    Icon: LayoutGrid,
    premium: true,
  },
  {
    id: 'campaign',
    label: 'Kampanyalar',
    short: 'Kampanya',
    Icon: Megaphone,
    premium: true,
  },
] as const;
type Look = Pick<Design, 'colorId' | 'withLogo' | 'frameId'>;

const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia('(max-width: 1099px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return narrow;
}

async function toDataUrl(src: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Logo alınamadı.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function BarcodePage() {
  const { user } = useAuth();
  const { isOwned, loading: addonsLoading } = useAddons();
  const qrPack = isOwned('qr-pack');
  const [searchParams] = useSearchParams();
  const narrow = useNarrow();
  const stageHost = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>('classic');
  const [design, setDesign] = useState<Design>(loadDesign);
  const initial = useMemo(loadTableGroups, []);
  const [groups, setGroups] = useState<TableGroup[]>(initial.groups);
  const [activeGroupId, setActiveGroupId] = useState(initial.activeGroupId);
  const [styles, setStyles] = useState<GroupStyles>(initial.styles);
  const [groupsReady, setGroupsReady] = useState(false);
  const [groupsReadOk, setGroupsReadOk] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignState, setCampaignState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const [groupDialog, setGroupDialog] = useState<'create' | 'edit' | null>(
    null,
  );
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [confirm, setConfirm] = useState<'group' | 'campaign' | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [callHighlight, setCallHighlight] = useState<{
    masa: string;
    type: string;
  } | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(
    user?.restaurant.logoUrl ?? null,
  );
  const saveFailed = useRef(false);
  const campaignName = useRef<{ id: number; name: string } | null>(null);

  const origin = window.location.origin;
  const logoSrc = logoPath ? imageUrl(logoPath) : '';
  const restaurantName = user?.restaurant.name || 'Menü';
  const notify = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );

  useEffect(
    () => setLogoPath(user?.restaurant.logoUrl ?? null),
    [user?.restaurant.logoUrl],
  );
  useEffect(() => {
    api<{ restaurant: { logoUrl?: string | null } }>('/api/admin/settings')
      .then((d) => setLogoPath(d.restaurant.logoUrl || null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
    } catch {
      /* storage may be blocked */
    }
  }, [design]);

  // Table groups: the server copy wins, the local copy is the fallback.
  useEffect(() => {
    const abort = new AbortController();
    api<{
      groups: {
        id: string;
        name: string;
        count: number;
        prefix?: string;
        styles?: Record<string, Partial<TableStyle>>;
      }[];
      activeGroupId: string;
    }>('/api/admin/barcode/table-groups', { signal: abort.signal })
      .then((d) => {
        if (abort.signal.aborted) return;
        if (!d.groups?.length) throw new Error('Masa grupları alınamadı.');
        setGroupsReadOk(true);
        setGroups(
          d.groups.map((g) => ({
            id: g.id,
            name: g.name,
            count: g.count,
            prefix: normalizePrefix(g.prefix || ''),
          })),
        );
        const next: GroupStyles = {};
        for (const g of d.groups) {
          next[g.id] = {};
          for (const [key, style] of Object.entries(g.styles || {})) {
            const n = Number(key);
            if (!Number.isFinite(n)) continue;
            next[g.id][n] = {
              ...defaultTableStyle(n, g.name, g.prefix || ''),
              ...style,
              frameId: isFrame(style.frameId) ? style.frameId : 'yok',
            };
          }
        }
        setStyles(next);
        setActiveGroupId(
          d.groups.some((g) => g.id === d.activeGroupId)
            ? d.activeGroupId
            : d.groups[0].id,
        );
      })
      .catch(() => {
        if (abort.signal.aborted) return;
        setGroupsReadOk(false);
        notify(
          'Masa grupları alınamadı. Yerel kopya açık; sunucu kaydı durduruldu. Sayfayı yenileyerek tekrar deneyin.',
          true,
        );
      })
      .finally(() => {
        if (!abort.signal.aborted) setGroupsReady(true);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!groupsReady) return;
    try {
      localStorage.setItem(
        GROUPS_KEY,
        JSON.stringify({ groups, activeGroupId, groupStyles: styles }),
      );
    } catch {
      /* storage may be blocked */
    }
    if (!groupsReadOk) return;
    const timer = window.setTimeout(() => {
      api('/api/admin/barcode/table-groups', {
        method: 'PUT',
        body: JSON.stringify({
          activeGroupId,
          groups: groups.map((g) => ({ ...g, styles: styles[g.id] || {} })),
        }),
      })
        .then(() => (saveFailed.current = false))
        .catch(() => {
          if (!saveFailed.current)
            notify(
              'Masa ayarları sunucuya kaydedilemedi. Bu tarayıcıda saklandı.',
              true,
            );
          saveFailed.current = true;
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [groups, activeGroupId, styles, groupsReady, groupsReadOk, notify]);

  const loadCampaigns = useCallback(() => {
    setCampaignState('loading');
    api<{ campaigns: CampaignRow[] }>('/api/admin/campaigns')
      .then((d) => {
        setCampaigns(d.campaigns || []);
        setCampaignState('ready');
      })
      .catch(() => setCampaignState('error'));
  }, []);
  useEffect(loadCampaigns, [loadCampaigns]);

  const activeGroup =
    groups.find((g) => g.id === activeGroupId) || groups[0] || null;
  const tables = useMemo(
    () =>
      Array.from(
        {
          length: activeGroup
            ? Math.max(1, Math.min(60, activeGroup.count))
            : 0,
        },
        (_, i) => i + 1,
      ),
    [activeGroup],
  );
  const styleOf = useCallback(
    (n: number) =>
      activeGroup
        ? readTableStyle(activeGroup, styles, n)
        : defaultTableStyle(n),
    [activeGroup, styles],
  );
  const urlOf = useCallback(
    (n: number) =>
      `${origin}/menu?masa=${encodeURIComponent(tableCode(n, activeGroup?.prefix))}&grup=${encodeURIComponent(activeGroup?.id || '')}`,
    [origin, activeGroup],
  );

  // Deep links from the call panel: ?view=tables&grup=…&masa=…&tip=…
  useEffect(() => {
    if (!groupsReady) return;
    const masa = searchParams.get('masa'),
      grup = searchParams.get('grup'),
      view = searchParams.get('view'),
      tip = searchParams.get('tip');
    if ((view === 'tables' || masa) && qrPack) setMode('tables');
    if (grup && groups.some((g) => g.id === grup)) setActiveGroupId(grup);
    if (!masa) return;
    const target =
      groups.find((g) => g.id === (grup || activeGroupId)) || groups[0];
    if (!target) return;
    for (let n = 1; n <= target.count; n++) {
      if (tableCode(n, target.prefix) === masa) {
        setActiveGroupId(target.id);
        setSelectedTable(n);
        if (tip) {
          setCallHighlight({ masa, type: tip });
          const what =
            tip === 'bill'
              ? 'Hesap istendi'
              : tip === 'valet'
                ? 'Vale çağrıldı'
                : tip === 'hookah'
                  ? 'Nargileci çağrıldı'
                  : 'Garson çağrıldı';
          notify(`${what} · Masa ${masa}`);
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsReady, searchParams, qrPack]);

  // There is always something on the stage: pick the first table / campaign when none is chosen.
  useEffect(() => {
    if (
      mode === 'tables' &&
      activeGroup &&
      (selectedTable === null || selectedTable > activeGroup.count)
    )
      setSelectedTable(1);
  }, [mode, activeGroup, selectedTable]);
  useEffect(() => {
    if (mode !== 'campaign' || campaignState !== 'ready') return;
    if (!campaigns.some((c) => c.id === campaignId))
      setCampaignId(campaigns[0]?.id ?? null);
  }, [mode, campaignState, campaigns, campaignId]);
  const campaign = campaigns.find((c) => c.id === campaignId) || null;
  useEffect(() => {
    campaignName.current = campaign
      ? { id: campaign.id, name: campaign.name }
      : null;
    // Only the selection matters: typing must not move the "last saved" name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // ── Look of the card being edited
  const locked = !qrPack;
  const lockedMode = locked && mode !== 'classic';
  const tableStyle =
    mode === 'tables' && selectedTable ? styleOf(selectedTable) : null;
  const look: Look = tableStyle
    ? {
        colorId: tableStyle.colorId,
        withLogo: tableStyle.withLogo,
        frameId: tableStyle.frameId,
      }
    : locked
      ? { colorId: 'black', withLogo: false, frameId: 'yok' }
      : {
          colorId: design.colorId,
          withLogo: design.withLogo,
          frameId: design.frameId,
        };
  const lookColor = resolveColor(look.colorId);
  const frameColor = lookColor.fg;

  function patchTable(n: number, patch: Partial<TableStyle>) {
    if (!activeGroup) return;
    setStyles((prev) => ({
      ...prev,
      [activeGroup.id]: {
        ...prev[activeGroup.id],
        [n]: { ...readTableStyle(activeGroup, prev, n), ...patch },
      },
    }));
  }
  function patchLook(patch: Partial<Look>) {
    if (mode === 'tables' && selectedTable) patchTable(selectedTable, patch);
    else setDesign((d) => ({ ...d, ...patch }));
  }
  function applyToAll() {
    if (!activeGroup || !tableStyle) return;
    const { colorId, withLogo, frameId } = tableStyle;
    setStyles((prev) => ({
      ...prev,
      [activeGroup.id]: Object.fromEntries(
        tables.map((n) => [
          n,
          {
            ...readTableStyle(activeGroup, prev, n),
            colorId,
            withLogo,
            frameId,
          },
        ]),
      ),
    }));
    notify(
      `Renk, çerçeve ve logo ${activeGroup.name} grubundaki ${tables.length} masaya uygulandı.`,
    );
  }

  const shape = locked ? { ...DEFAULT_DESIGN } : design;
  const specOf = useCallback(
    (
      key: string,
      title: string,
      subtitle: string,
      url: string,
      l: Look,
    ): CardSpec => {
      const c = resolveColor(l.colorId);
      return {
        key,
        title,
        subtitle,
        url,
        fg: c.fg,
        bg: c.bg,
        logo: l.withLogo && logoSrc ? logoSrc : undefined,
        frameId: l.frameId,
        template: shape.template,
        cta: shape.cta,
        showUrl: shape.showUrl,
      };
    },
    [logoSrc, shape.template, shape.cta, shape.showUrl],
  );
  const designLook: Look = locked
    ? { colorId: 'black', withLogo: false, frameId: 'yok' }
    : {
        colorId: design.colorId,
        withLogo: design.withLogo,
        frameId: design.frameId,
      };
  const spec: CardSpec | null =
    lockedMode || (mode === 'tables' && !groupsReady)
      ? null
      : mode === 'classic'
        ? specOf('classic', restaurantName, '', `${origin}/menu`, designLook)
        : mode === 'tables'
          ? tableStyle && selectedTable
            ? specOf(
                `t-${activeGroup?.id}-${selectedTable}`,
                tableStyle.name,
                restaurantName,
                urlOf(selectedTable),
                look,
              )
            : null
          : campaign
            ? specOf(
                `c-${campaign.id}`,
                campaign.name,
                restaurantName,
                `${origin}/menu?kampanya=${encodeURIComponent(campaign.slug)}`,
                designLook,
              )
            : null;

  // ── Actions
  function createGroup(data: GroupForm) {
    let id = slugify(data.name) || `grup-${Date.now()}`;
    if (groups.some((g) => g.id === id)) id = `${id}-${Date.now()}`;
    setGroups((prev) => [
      ...prev,
      {
        id,
        name: data.name,
        count: data.count,
        prefix: normalizePrefix(data.prefix),
      },
    ]);
    setActiveGroupId(id);
    setSelectedTable(1);
    setGroupDialog(null);
    notify(`${data.name} grubu eklendi.`);
  }
  function editGroup(data: GroupForm) {
    if (!activeGroup) return;
    setStyles((prev) => ({
      ...prev,
      [activeGroup.id]: Object.fromEntries(
        Object.entries(prev[activeGroup.id] || {}).map(([key, style]) => {
          const n = Number(key),
            autoName = defaultTableStyle(
              n,
              activeGroup.name,
              activeGroup.prefix,
            ).name;
          return [
            key,
            {
              ...style,
              name:
                !style.name ||
                style.name === String(n) ||
                style.name === autoName
                  ? defaultTableStyle(n, data.name, data.prefix).name
                  : style.name,
            },
          ];
        }),
      ),
    }));
    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroup.id
          ? {
              ...g,
              name: data.name,
              count: data.count,
              prefix: normalizePrefix(data.prefix),
            }
          : g,
      ),
    );
    setGroupDialog(null);
    notify('Grup güncellendi.');
  }
  function deleteGroup() {
    if (!activeGroup || groups.length <= 1) return;
    const next = groups.filter((g) => g.id !== activeGroup.id);
    setGroups(next);
    setActiveGroupId(next[0].id);
    setStyles((prev) => {
      const copy = { ...prev };
      delete copy[activeGroup.id];
      return copy;
    });
    setSelectedTable(1);
    setConfirm(null);
    notify(`${activeGroup.name} grubu silindi.`);
  }
  async function addCampaign(name: string) {
    if (campaignSaving) return;
    setCampaignSaving(true);
    try {
      const created = await api<CampaignRow>('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setCampaigns((prev) => [...prev, created]);
      setCampaignId(created.id);
      setCampaignDialog(false);
      setMenuOpen(true);
      notify('Kampanya eklendi. Şimdi özel menüsünü hazırla.');
    } catch (error) {
      notify(message(error, 'Kampanya eklenemedi.'), true);
    } finally {
      setCampaignSaving(false);
    }
  }
  async function deleteCampaign() {
    if (!campaign || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await api(`/api/admin/campaigns/${campaign.id}`, { method: 'DELETE' });
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      setCampaignId(null);
      setConfirm(null);
      notify(`${campaign.name} kampanyası silindi.`);
    } catch (error) {
      notify(message(error, 'Kampanya silinemedi.'), true);
    } finally {
      setConfirmBusy(false);
    }
  }
  function renameCampaignLive(name: string) {
    if (!campaign) return;
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaign.id ? { ...c, name } : c)),
    );
  }
  async function commitCampaignName() {
    if (!campaign) return;
    const saved = campaignName.current;
    const name = campaign.name.trim();
    if (!name) {
      renameCampaignLive(saved?.name || 'Kampanya');
      return;
    }
    if (saved?.id === campaign.id && saved.name === name) return;
    try {
      const updated = await api<CampaignRow>(
        `/api/admin/campaigns/${campaign.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name }),
        },
      );
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                ...updated,
                name: c.name.trim() === name ? updated.name : c.name,
              }
            : c,
        ),
      );
      if (campaignName.current?.id === updated.id)
        campaignName.current = { id: updated.id, name: updated.name };
    } catch (error) {
      if (saved?.id === campaign.id)
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === saved.id && c.name.trim() === name
              ? { ...c, name: saved.name }
              : c,
          ),
        );
      notify(message(error, 'Kampanya adı güncellenemedi.'), true);
    }
  }

  async function copyLink() {
    if (!spec) return false;
    try {
      await navigator.clipboard.writeText(spec.url);
    } catch {
      const area = document.createElement('textarea');
      area.value = spec.url;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (!ok) {
        notify('Bağlantı kopyalanamadı.', true);
        return false;
      }
    }
    return true;
  }
  async function download(kind: 'png' | 'svg') {
    const svg =
      stageHost.current?.querySelector<SVGSVGElement>('.bq-card__qr svg');
    if (!svg || !spec) return;
    try {
      const copy = svg.cloneNode(true) as SVGSVGElement;
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', '1024');
      copy.setAttribute('height', '1024');
      // Images inside an SVG file cannot be fetched later, so the logo is embedded.
      for (const image of Array.from(copy.querySelectorAll('image'))) {
        const href = image.getAttribute('href');
        if (href && !href.startsWith('data:')) {
          try {
            image.setAttribute('href', await toDataUrl(href));
          } catch {
            image.remove();
            notify('Logo eklenemedi; QR logosuz indirildi.', true);
          }
        }
      }
      const markup = new XMLSerializer().serializeToString(copy);
      const name = `${slugify(spec.title) || 'qr'}.${kind}`;
      let blob: Blob;
      if (kind === 'svg') blob = new Blob([markup], { type: 'image/svg+xml' });
      else {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('QR görseli oluşturulamadı.'));
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
        });
        const canvas = document.createElement('canvas');
        const pad = 64;
        canvas.width = canvas.height = 1024 + pad * 2;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = spec.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, pad, pad, 1024, 1024);
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('PNG oluşturulamadı.'))),
            'image/png',
          ),
        );
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify(`${name} indirildi.`);
    } catch (error) {
      notify(message(error, 'QR indirilemedi.'), true);
    }
  }
  function print(settings: PrintSettings) {
    if (!spec) return;
    const cards =
      settings.scope === 'all' && mode === 'tables' && activeGroup
        ? tables.map((n) => {
            const s = styleOf(n);
            return specOf(
              `t-${activeGroup.id}-${n}`,
              s.name,
              restaurantName,
              urlOf(n),
              s,
            );
          })
        : Array.from(
            {
              length: Math.max(
                1,
                settings.paperId.endsWith('mm') ? 1 : settings.perPage,
              ),
            },
            () => spec,
          );
    setPrintOpen(false);
    setPrintJob({
      cards,
      paperId: settings.paperId,
      perPage: settings.perPage,
      cut: settings.cut,
    });
  }

  if (addonsLoading) return <Spinner />;

  const modeIndex = MODES.findIndex((m) => m.id === mode);
  const compact = narrow && mode !== 'classic';
  const upsellWhat = mode === 'tables' ? 'Masa QR’ları' : 'Kampanya QR’ları';
  const shapeProps = {
    template: shape.template,
    onTemplate: (template: Design['template']) =>
      setDesign((d) => ({ ...d, template })),
  };
  const panels = (
    <>
      <Field label="Şablon">
        <TemplateControl
          value={shapeProps.template}
          fg={lookColor.fg}
          bg={lookColor.bg}
          onChange={shapeProps.onTemplate}
        />
      </Field>
      <Field label="Renk">
        <ColorControl
          value={look.colorId}
          onChange={(colorId) => patchLook({ colorId })}
        />
        <LogoControl
          checked={look.withLogo}
          hasLogo={Boolean(logoSrc)}
          onChange={(withLogo) => patchLook({ withLogo })}
        />
      </Field>
      <Field label="Çerçeve">
        <FrameControl
          value={look.frameId}
          color={frameColor}
          onChange={(frameId) => patchLook({ frameId })}
        />
      </Field>
      <Field label="Yazılar">{textControls()}</Field>
      {mode === 'tables' && activeGroup && tables.length > 1 && (
        <button type="button" className="bq-apply" onClick={applyToAll}>
          Bu tasarımı {activeGroup.name} grubundaki tüm masalara uygula
        </button>
      )}
    </>
  );
  function textControls() {
    return (
      <TextControls
        titleLabel={mode === 'tables' ? 'Masa adı' : 'Kampanya adı'}
        title={mode === 'tables' ? tableStyle?.name : campaign?.name}
        onTitle={
          mode === 'tables' && selectedTable
            ? (name) => patchTable(selectedTable, { name })
            : mode === 'campaign' && campaign
              ? renameCampaignLive
              : undefined
        }
        onTitleCommit={
          mode === 'tables' && selectedTable
            ? () =>
                patchTable(selectedTable, {
                  name:
                    (tableStyle?.name || '').trim() ||
                    defaultTableStyle(
                      selectedTable,
                      activeGroup?.name,
                      activeGroup?.prefix,
                    ).name,
                })
            : mode === 'campaign'
              ? () => void commitCampaignName()
              : undefined
        }
        cta={design.cta}
        onCta={(cta) => setDesign((d) => ({ ...d, cta }))}
        showUrl={design.showUrl}
        onShowUrl={(showUrl) => setDesign((d) => ({ ...d, showUrl }))}
      />
    );
  }
  const trayPanels = {
    color: (
      <>
        <ColorControl
          value={look.colorId}
          onChange={(colorId) => patchLook({ colorId })}
        />
        <LogoControl
          checked={look.withLogo}
          hasLogo={Boolean(logoSrc)}
          onChange={(withLogo) => patchLook({ withLogo })}
        />
        {mode === 'tables' && activeGroup && tables.length > 1 && (
          <button type="button" className="bq-apply" onClick={applyToAll}>
            Tüm masalara uygula
          </button>
        )}
      </>
    ),
    frame: (
      <FrameControl
        value={look.frameId}
        color={frameColor}
        onChange={(frameId) => patchLook({ frameId })}
      />
    ),
    template: (
      <TemplateControl
        value={shape.template}
        fg={lookColor.fg}
        bg={lookColor.bg}
        onChange={shapeProps.onTemplate}
      />
    ),
    text: textControls(),
  };
  const printLabel = 'Yazdır';
  const allCount = mode === 'tables' && activeGroup ? tables.length : 0;

  return (
    <div className={`bq-page${narrow ? ' is-narrow' : ''}`}>
      <AdminToast
        notice={notice}
        onClose={() => setNotice(null)}
        className="bq-toast"
      />
      <header className="bq-head">
        <PageHeading title="Barkod Yazdır" subtitle="Menüye götüren QR kartını tasarla, yazdır." />
        {!narrow && (
          <button
            type="button"
            className="bq-primary"
            disabled={!spec}
            onClick={() => setPrintOpen(true)}
          >
            <Printer size={18} /> {printLabel}
          </button>
        )}
      </header>
      <div
        className="bq-modes"
        role="group"
        aria-label="Barkod türü"
        style={{ '--i': modeIndex, '--n': MODES.length } as React.CSSProperties}
      >
        <i className="bq-modes__pill" aria-hidden="true" />
        {MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            <m.Icon size={18} />
            <span>{narrow ? m.short : m.label}</span>
            {m.premium && locked && (
              <Lock size={13} aria-label="QR paketi gerekli" />
            )}
          </button>
        ))}
      </div>
      {lockedMode ? (
        <Upsell what={upsellWhat} />
      ) : (
        <div className="bq-body">
          <div className="bq-work" key={mode}>
            {mode === 'tables' && !groupsReady && <Spinner />}
            {mode === 'tables' && activeGroup && groupsReady && (
              <TablesTargets
                groups={groups}
                active={activeGroup}
                tables={tables}
                selected={selectedTable}
                logo={logoSrc}
                callCode={callHighlight?.masa ?? null}
                styleOf={styleOf}
                urlOf={urlOf}
                codeOf={(n) => tableCode(n, activeGroup.prefix)}
                canDelete={groups.length > 1}
                onGroup={(id) => {
                  setActiveGroupId(id);
                  setSelectedTable(1);
                  setCallHighlight(null);
                }}
                onAddGroup={() => setGroupDialog('create')}
                onEditGroup={() => setGroupDialog('edit')}
                onDeleteGroup={() => setConfirm('group')}
                onCount={(count) =>
                  setGroups((prev) =>
                    prev.map((g) =>
                      g.id === activeGroup.id ? { ...g, count } : g,
                    ),
                  )
                }
                onSelect={(n) => {
                  setSelectedTable(n);
                  setCallHighlight(null);
                }}
              />
            )}
            {mode === 'campaign' && (
              <CampaignTargets
                state={campaignState}
                campaigns={campaigns}
                selectedId={campaignId}
                origin={origin}
                onSelect={setCampaignId}
                onAdd={() => setCampaignDialog(true)}
                onMenu={() => setMenuOpen(true)}
                onDelete={() => setConfirm('campaign')}
                onRetry={loadCampaigns}
              />
            )}
            {mode === 'classic' && (
              <section className="bq-card-panel bq-intro">
                <h2>Herkesin ana menüsü</h2>
                <p>
                  Bu QR, işletmenin dijital menüsünü açar. Kapıya, vitrine,
                  kartvizite ya da fişe koyabilirsin.
                </p>
              </section>
            )}
            {!narrow && spec && (
              <section className="bq-card-panel bq-design">
                <h2>Tasarım</h2>
                {locked ? (
                  <Upsell what="Renk, çerçeve ve logo" />
                ) : (
                  <div className="bq-design__grid">{panels}</div>
                )}
              </section>
            )}
            {narrow && locked && spec && (
              <Upsell what="Renk, çerçeve ve logo" />
            )}
          </div>
          <div ref={stageHost} className="bq-stagehost">
            <Stage
              spec={spec}
              heading={MODES[modeIndex].label}
              compact={compact}
              empty={
                <span>
                  Önizlemek için bir{' '}
                  {mode === 'campaign' ? 'kampanya ekle' : 'masa seç'}.
                </span>
              }
              onCopy={copyLink}
              onPng={() => void download('png')}
              onSvg={() => void download('svg')}
            />
          </div>
        </div>
      )}
      {narrow && !lockedMode && (
        <DesignDock
          panels={trayPanels}
          locked={locked || (mode === 'tables' && !groupsReady)}
          printLabel={printLabel}
          printDisabled={!spec}
          onPrint={() => setPrintOpen(true)}
        />
      )}
      <GroupDialog
        open={groupDialog !== null}
        initial={
          groupDialog === 'edit' && activeGroup
            ? {
                name: activeGroup.name,
                count: activeGroup.count,
                prefix: activeGroup.prefix,
              }
            : null
        }
        onClose={() => setGroupDialog(null)}
        onSubmit={groupDialog === 'edit' ? editGroup : createGroup}
      />
      <CampaignDialog
        open={campaignDialog}
        saving={campaignSaving}
        onClose={() => setCampaignDialog(false)}
        onSubmit={(n) => void addCampaign(n)}
      />
      <ConfirmDialog
        open={confirm === 'group'}
        title="Grup silinsin mi?"
        text={`“${activeGroup?.name}” grubu ve masa tasarımları silinir. Basılı QR’lar eskisi gibi çalışmaya devam eder.`}
        confirmLabel="Grubu sil"
        onClose={() => setConfirm(null)}
        onConfirm={deleteGroup}
      />
      <ConfirmDialog
        open={confirm === 'campaign'}
        title="Kampanya silinsin mi?"
        text={`“${campaign?.name}” kampanyası ve özel menüsü silinir. Bu kampanyanın QR’ı artık çalışmaz.`}
        confirmLabel="Kampanyayı sil"
        busy={confirmBusy}
        onClose={() => !confirmBusy && setConfirm(null)}
        onConfirm={() => void deleteCampaign()}
      />
      <CampaignMenuModal
        open={menuOpen}
        campaignId={campaign?.id ?? null}
        campaignName={campaign?.name ?? ''}
        onClose={() => setMenuOpen(false)}
        onSaved={(itemCount) => {
          if (campaign)
            setCampaigns((prev) =>
              prev.map((c) => (c.id === campaign.id ? { ...c, itemCount } : c)),
            );
        }}
      />
      <PrintDialog
        open={printOpen}
        title={spec?.title || ''}
        allCount={allCount}
        allLabel={`${activeGroup?.name || 'Grup'} masalarının hepsi`}
        onClose={() => setPrintOpen(false)}
        onPrint={print}
      />
      {printJob && (
        <PrintSheet job={printJob} onDone={() => setPrintJob(null)} />
      )}
    </div>
  );
}
