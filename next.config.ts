import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const extraImgHosts = (process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => `https://${d}`);

// Even if a malicious image slipped into an answer, the browser would refuse to load it.
// script-src is left to Next's defaults (inline bootstrap scripts need a nonce setup to restrict).
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${extraImgHosts.join(" ")}`.trim(),
  `connect-src 'self' ${apiUrl}${isDev ? " ws:" : ""}`,
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
