import type { ReactNode } from 'react';
import type { SofraConfig } from '@/lib/sofra';
import type { SofraEditing, SofraGroup, SofraProduct, SofraRestaurant } from './SofraElements';

export interface SofraShowcaseItem {
  id: number;
  imageUrl?: string | null;
  title1: string;
  title2: string;
}

export interface SofraWelcomeAction {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}
export interface SofraWelcomeMusic {
  on: boolean;
  playing: boolean;
  label: string;
  onToggle: () => void;
}

export type SofraWelcomeProps = {
  config: SofraConfig;
  restaurant: SofraRestaurant;
  lang: string;
  languages: { code: string; name: string }[];
  onLangChange?: (code: string) => void;
  onEnter?: () => void;
  tableLabel?: string | null;
  /** Secondary actions (preferences, feedback…). Chips on desktop, one expanding button on mobile. */
  actions?: SofraWelcomeAction[];
  music?: SofraWelcomeMusic;
  extra?: ReactNode;
  entering?: boolean;
} & SofraEditing;

export type SofraMenuProps = {
  config: SofraConfig;
  lang: string;
  restaurant: SofraRestaurant;
  groups: SofraGroup[];
  activeGroup?: number | null;
  onGroupChange?: (id: number | null) => void;
  products: SofraProduct[];
  subgroups?: { id: number; name: string; products: SofraProduct[] }[];
  onProductOpen?: (id: number) => void;
  /** `from` is the pressed element; the cart uses it as the start of its fly animation. */
  onAdd?: (product: SofraProduct, from?: HTMLElement | null) => void;
  search?: string;
  searchSuggestion?: string;
  onSearchChange?: (text: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  headerTools?: ReactNode;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
  stories?: ReactNode;
  showcase?: SofraShowcaseItem[];
} & SofraEditing;
