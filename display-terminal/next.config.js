/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@shared'],
  experimental: {
    optimizePackageImports: ['@shared'],
  },
}

module.exports = nextConfig
