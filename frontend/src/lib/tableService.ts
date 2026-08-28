export const MENU_TABLE_SERVICE_KEY = 'menu_table_service_enabled';

export function isTableServiceEnabled(raw?: string | null): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === 'true' || raw === '1';
}
