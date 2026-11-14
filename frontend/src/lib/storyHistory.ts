/** A replaced photo or linked product is a new story even when its database id is reused. */
export function storySeenKey(story: {
  id: number;
  imageUrl: string;
  productId: number;
}) {
  return `${story.id}:${story.imageUrl}:${story.productId}`;
}

export function readSeenStories(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string').slice(-500)
      : [];
  } catch {
    return [];
  }
}
