import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Table Plan', short_name: 'Table Plan', start_url: '/plan', display: 'standalone',
    background_color: '#f2f2f6', theme_color: '#f2f2f6',
  };
}
