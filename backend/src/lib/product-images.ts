export function parseProductImages(product: {
  images?: unknown;
  imageUrl?: string | null;
}): string[] {
  if (Array.isArray(product.images)) {
    const list = product.images.filter(
      (u): u is string => typeof u === 'string' && u.trim().length > 0
    );
    if (list.length > 0) return list;
  }
  return product.imageUrl ? [product.imageUrl] : [];
}

export function imagesPayload(images: string[]) {
  const clean = images.filter((u) => u.trim());
  return {
    images: clean,
    imageUrl: clean[0] ?? null,
  };
}
