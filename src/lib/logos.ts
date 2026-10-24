declare const __LOGO_MORRISONS_LIGHT__: string | undefined;
declare const __LOGO_MORRISONS_DARK__: string | undefined;

/** Official Morrisons wordmark (their site's own light/dark SVGs). The preview build inlines them as data URIs. */
export const MORRISONS_LOGO = {
  light: typeof __LOGO_MORRISONS_LIGHT__ !== 'undefined' ? __LOGO_MORRISONS_LIGHT__ : '/logos/morrisons-light.svg',
  dark: typeof __LOGO_MORRISONS_DARK__ !== 'undefined' ? __LOGO_MORRISONS_DARK__ : '/logos/morrisons-dark.svg',
};
