import { useRef } from 'react';
import SahneWelcome from '../sahne/SahneWelcome';
import SahneMenuDesktop from '../sahne/SahneMenuDesktop';
import SahneMenuMobile from '../sahne/SahneMenuMobile';
import { MOBILE_QUERY, useMedia } from '../sahne/shared';
import type { SofraMenuProps, SofraWelcomeProps } from './types';
import './sofra.css';
import './sofra-overlays.css';

export { SofraText, SofraBrand } from './SofraElements';
export type { SofraEditing, SofraRestaurant, SofraGroup, SofraProduct } from './SofraElements';
export type { SofraMenuProps, SofraWelcomeProps, SofraShowcaseItem } from './types';

// Entry points used by the customer pages and the theme editor. The current look ("Sahne")
// lives in ../sahne; desktop and mobile are separate designs, not one layout resized.
export function SofraWelcomeView(props: SofraWelcomeProps) {
  return <SahneWelcome {...props} />;
}

export function SofraMenuView(props: SofraMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const mobile = useMedia(root, MOBILE_QUERY);
  return (
    <div ref={root} style={{ display: 'contents' }}>
      {mobile ? <SahneMenuMobile {...props} /> : <SahneMenuDesktop {...props} />}
    </div>
  );
}
