import { api } from '@/lib/api';
import { ADMIN_PREVIEW_TABLE } from '@/lib/tableContext';

/** QR / menü açılışında masa oturumunu başlatır (admin önizleme hariç) */
export function checkInTable(slug: string | null | undefined, masa: string | null | undefined, grup?: string | null) {
  if (!slug || !masa || masa === ADMIN_PREVIEW_TABLE) return;
  void api(`/api/menu/${slug}/table-checkin`, {
    method: 'POST',
    body: JSON.stringify({
      tableNumber: masa,
      groupSlug: grup || undefined,
    }),
  }).catch(() => {
    /* best-effort */
  });
}
