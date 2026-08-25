import { prisma } from './prisma.js';

export type CampaignItemCtx = {
  productId: number;
  groupId: number;
  price: number;
  sortOrder: number;
  currency: {
    id: number;
    code: string;
    name: string;
    symbol: string;
  } | null;
};

export type CampaignCtx = {
  id: number;
  name: string;
  slug: string;
  itemByProductId: Map<number, CampaignItemCtx>;
  productIds: number[];
  groupIds: Set<number>;
};

export function getCampaignSlug(query: Record<string, unknown>): string {
  return String(query.kampanya || query.campaign || '').trim();
}

export async function loadCampaignContext(
  restaurantId: number,
  campaignSlug: string | null | undefined
): Promise<CampaignCtx | null> {
  const slug = String(campaignSlug || '').trim();
  if (!slug) return null;

  const campaign = await prisma.campaign.findFirst({
    where: { restaurantId, slug, isActive: true },
    include: {
      items: {
        include: {
          currency: true,
          product: { select: { id: true, groupId: true, isActive: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!campaign) return null;

  const itemByProductId = new Map<number, CampaignItemCtx>();
  const groupIds = new Set<number>();

  for (const item of campaign.items) {
    if (!item.product?.isActive) continue;
    itemByProductId.set(item.productId, {
      productId: item.productId,
      groupId: item.product.groupId,
      price: Number(item.price),
      sortOrder: item.sortOrder,
      currency: item.currency
        ? {
            id: item.currency.id,
            code: item.currency.code,
            name: item.currency.name,
            symbol: item.currency.symbol,
          }
        : null,
    });
    groupIds.add(item.product.groupId);
  }

  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    itemByProductId,
    productIds: [...itemByProductId.keys()],
    groupIds,
  };
}

export function applyCampaignPrice<T extends {
  price: number;
  currency: { code: string; name: string; symbol: string };
}>(
  productId: number,
  base: T,
  campaign: CampaignCtx | null,
  mapCurrency: (
    currency?: { id: number; code: string; name: string; symbol: string } | null
  ) => { code: string; name: string; symbol: string }
): T {
  if (!campaign) return base;
  const item = campaign.itemByProductId.get(productId);
  if (!item) return base;
  return {
    ...base,
    price: item.price,
    currency: item.currency ? mapCurrency(item.currency) : base.currency,
  };
}
