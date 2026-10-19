/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@typex/types',
    '@typex/ai',
    '@typex/platforms',
    '@typex/agents',
    '@typex/permissions',
    '@typex/memory',
    '@typex/execution',
    '@typex/db',
    '@typex/whatsapp',
    '@typex/generic-web',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

module.exports = nextConfig;
