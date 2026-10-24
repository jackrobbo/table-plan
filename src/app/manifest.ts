import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Table Plan', short_name: 'Table Plan',
    description: 'Your goals. Your meals. Your budget. A realistic weekly meal plan and shopping list from your nutritional goals and favourite meals.',
    id: '/plan', start_url: '/plan', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'en-GB',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    background_color: '#f2f2f6', theme_color: '#f2f2f6',
  };
}
