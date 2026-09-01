export function daysUntilLicenseEnd(expiresAt?: string | Date | null): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function formatLicenseDate(expiresAt?: string | Date | null) {
  if (!expiresAt) return '';
  try {
    return new Date(expiresAt).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
