declare const __LOGO_MORRISONS_LIGHT__: string | undefined;
declare const __LOGO_MORRISONS_DARK__: string | undefined;

/** Official Morrisons wordmark (their site's own light/dark SVGs). The preview build inlines them as data URIs. */
export const MORRISONS_LOGO = {
  light: typeof __LOGO_MORRISONS_LIGHT__ !== 'undefined' ? __LOGO_MORRISONS_LIGHT__ : '/logos/morrisons-light.svg',
  dark: typeof __LOGO_MORRISONS_DARK__ !== 'undefined' ? __LOGO_MORRISONS_DARK__ : '/logos/morrisons-dark.svg',
};

/** Wordmarks by store, where we have one. A store without one shows its name as text (see RetailerLogo). */
export const STORE_LOGOS: Partial<Record<string, { light: string; dark: string }>> = { morrisons: MORRISONS_LOGO };
