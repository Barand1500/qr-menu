import { api } from '@/lib/api';

export async function autoTranslate(
  text: string,
  from: string,
  to: string
): Promise<string> {
  const result = await api<{ text: string }>('/api/admin/translate', {
    method: 'POST',
    body: JSON.stringify({ text, from, to }),
  });
  return result.text;
}
