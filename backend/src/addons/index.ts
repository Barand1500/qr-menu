export type { AddonProductId, AddonCategory, AddonProductDef } from './types.js';
export { ADDON_PRODUCTS, themeIdToAddon } from './catalog.js';
export {
  DEFAULT_WELCOME_THEME,
  DEFAULT_MENU_THEME,
  FREE_WELCOME_THEMES,
  FREE_MENU_THEMES,
  getRestaurantThemes,
  isWelcomeThemeAllowed,
  isMenuThemeAllowed,
} from './themes.js';
export {
  loadAddonConfig,
  getExpectedCode,
  validateUnlockCode,
  getOwnedAddons,
  getDisabledAddons,
  ownsAddon,
  isAddonActive,
  setAddonEnabled,
  unlockAddon,
  resetOwnedAddons,
} from './ownership.js';
