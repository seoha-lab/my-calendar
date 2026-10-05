import withSerwist from "@serwist/next";
import { fileURLToPath } from "url";
import path from "path";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A fresh revision per build prevents stale HTML referencing old chunks.
const shellRevision = randomUUID();
const withSW = withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  register: true,
  additionalPrecacheEntries: [
    { url: "/", revision: shellRevision },
    { url: "/today", revision: shellRevision },
    { url: "/settings", revision: shellRevision },
  ],
  scope: "/",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Silence workspace root inference warning by pinning the tracing root to this project
  outputFileTracingRoot: __dirname,
  images: {
    dangerouslyAllowSVG: true,
  },
  crossOrigin: "anonymous",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" }
        ],
      },
    ];
  },
};

export default withSW(baseConfig);
