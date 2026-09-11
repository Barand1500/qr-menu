import { useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import {
  collectAdminPageAnimTargets,
  getAdminPageAnimPreset,
} from '@/lib/adminPageAnimation';

export default function AdminPageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const animKey = `${location.pathname}${location.key || ''}`;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      if (prefersReducedMotion()) {
        gsap.set(root, { clearProps: 'all' });
        return;
      }

      const preset = getAdminPageAnimPreset();
      const targets = collectAdminPageAnimTargets(root);

      if (targets.length === 0) {
        gsap.fromTo(
          root,
          { opacity: 0, y: Math.round(preset.y * 0.45) },
          {
            opacity: 1,
            y: 0,
            duration: preset.duration,
            ease: preset.ease,
            clearProps: 'transform,opacity',
          }
        );
        return;
      }

      gsap.fromTo(
        targets,
        {
          opacity: 0,
          y: preset.y,
          scale: preset.scale,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: preset.duration,
          stagger: preset.stagger,
          ease: preset.ease,
          clearProps: 'transform,opacity',
        }
      );
    },
    {
      dependencies: [animKey],
      scope: rootRef,
      revertOnUpdate: true,
    }
  );

  return (
    <div ref={rootRef} className="admin-page-transition" key={animKey}>
      {children}
    </div>
  );
}
