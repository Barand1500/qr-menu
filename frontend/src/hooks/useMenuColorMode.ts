import { useCallback, useEffect, useState } from 'react';
import {
  defaultColorModeForTheme,
  loadMenuColorMode,
  saveMenuColorMode,
  toggleMenuColorMode,
  type MenuColorMode,
  type MenuThemeId,
} from '@/lib/menuColorMode';

export function useMenuColorMode(menuTheme: MenuThemeId) {
  const [colorMode, setColorMode] = useState<MenuColorMode>(() =>
    loadMenuColorMode(menuTheme)
  );

  useEffect(() => {
    setColorMode(loadMenuColorMode(menuTheme));
  }, [menuTheme]);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = toggleMenuColorMode(prev);
      saveMenuColorMode(next);
      return next;
    });
  }, []);

  const isDefaultMode = colorMode === defaultColorModeForTheme(menuTheme);

  return { colorMode, toggleColorMode, isNight: colorMode === 'night', isDefaultMode };
}
