/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/poc', destination: '/poc/index.html' }];
  },
};
