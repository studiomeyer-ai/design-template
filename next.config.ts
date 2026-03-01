import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/agents.json',
        destination: '/api/well-known/agents-json',
      },
      {
        source: '/.well-known/agent-card.json',
        destination: '/api/well-known/agent-card-json',
      },
      // IndexNow key verification (Bing/Yandex)
      {
        source: '/7536dd7636e93d1d5f7eca797af976c8620bbc5a28c0e513db55f993b74d74ac.txt',
        destination: '/api/indexnow-key',
      },
    ];
  },
};

export default withNextIntl(nextConfig);
