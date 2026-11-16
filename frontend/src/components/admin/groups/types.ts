export interface AdminGroup {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  isSubGroup: boolean;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  childrenCount: number;
  productCount: number;
  translations: { languageId: number; languageCode: string; name: string }[];
}
