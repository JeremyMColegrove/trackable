import { withGTConfig } from "gt-next/config"

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? ""
const shouldEnableHsts = appUrl.startsWith("https://")

const securityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
  ...(shouldEnableHsts
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
]

const ngrokHost = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: false,
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ngrokHost ? [ngrokHost] : [],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ]
  },
}

export default withGTConfig(nextConfig, {
  experimentalLocaleResolution: true,
})
