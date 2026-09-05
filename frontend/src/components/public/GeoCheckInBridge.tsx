import { useEffect } from 'react';
import { checkInTable } from '@/lib/tableCheckin';
import type { GeoCoords } from '@/lib/geoLock';

/** Konum doğrulandıktan sonra masa check-in */
export default function GeoCheckInBridge({
  slug,
  masa,
  grup,
  coords,
}: {
  slug: string | null | undefined;
  masa: string | null | undefined;
  grup?: string | null;
  coords: GeoCoords | null;
}) {
  useEffect(() => {
    if (!slug || !masa) return;
    checkInTable(slug, masa, grup, coords ?? undefined);
  }, [slug, masa, grup, coords]);
  return null;
}
