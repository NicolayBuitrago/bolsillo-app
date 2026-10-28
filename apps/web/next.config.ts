import type { NextConfig } from 'next';
import { z } from 'zod';

const env = z
  .object({
    // Where the Next.js server forwards /api/* (the Hono API). Server-side only.
    API_INTERNAL_URL: z.url({ protocol: /^https?$/ }),
  })
  .parse(process.env);

const apiUrl = env.API_INTERNAL_URL.replace(/\/$/, '');

const nextConfig: NextConfig = {
  // Workspace packages export TypeScript source.
  transpilePackages: ['@bolsillo/api-client', '@bolsillo/core'],
  // The browser only talks to this origin, so auth cookies are first-party.
  // Better Auth lives at /api/auth/* on the API; everything else drops the /api prefix.
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${apiUrl}/api/auth/:path*` },
      { source: '/api/:path*', destination: `${apiUrl}/:path*` },
    ];
  },
};

export default nextConfig;
