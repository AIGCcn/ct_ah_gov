/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  eslint: {
    // tailwindcss ESLint plugin fails to resolve tailwindcss in pnpm monorepo;
    // type-checking is still enforced by TypeScript.
    ignoreDuringBuilds: true
  },
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['pdfjs-dist', 'pdf-parse', '@napi-rs/canvas', 'ws']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com'
      }
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdf-parse / pdfjs-dist are server-only; do not bundle for the client
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdf-parse': false,
        'pdfjs-dist': false,
        '@napi-rs/canvas': false,
      }
    }
    return config
  }
}
