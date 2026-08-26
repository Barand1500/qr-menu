import {
  Camera,
  Globe,
  Heart,
  Link2,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { CustomIconKey, SocialPlatformId } from '@/lib/socialCatalog';
import { isCustomSocialId } from '@/lib/socialCatalog';
import SocialBrandIcon from '@/components/SocialBrandIcon';
import { imageUrl } from '@/lib/api';

const CUSTOM_ICONS: Record<CustomIconKey, LucideIcon> = {
  link: Link2,
  globe: Globe,
  star: Star,
  heart: Heart,
  map: MapPin,
  phone: Phone,
  mail: Mail,
  shop: ShoppingBag,
  utensils: UtensilsCrossed,
  camera: Camera,
};

interface SocialDisplayIconProps {
  id: string;
  iconKey?: CustomIconKey | string | null;
  iconUrl?: string | null;
  className?: string;
}

export function SocialDisplayIcon({
  id,
  iconKey,
  iconUrl,
  className = 'w-4 h-4',
}: SocialDisplayIconProps) {
  if (iconUrl) {
    return (
      <img
        src={imageUrl(iconUrl)}
        alt=""
        className={`${className} !w-full !h-full object-cover rounded-[0.45rem]`}
      />
    );
  }

  if (isCustomSocialId(id) || iconKey) {
    const key = (iconKey || 'link') as CustomIconKey;
    const Icon = CUSTOM_ICONS[key] || Link2;
    return <Icon className={className} strokeWidth={2.25} />;
  }

  return <SocialBrandIcon id={id as SocialPlatformId} className={className} />;
}

export { CUSTOM_ICONS };
