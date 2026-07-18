import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
