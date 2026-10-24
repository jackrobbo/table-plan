import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Table Plan', short_name: 'Table Plan', start_url: '/plan', display: 'standalone',
    background_color: '#f6f7f2', theme_color: '#1f4430',
  };
}
