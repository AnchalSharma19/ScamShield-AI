import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js loads its Node worker script from disk at runtime; bundling
  // it breaks that path resolution, so it must run as a plain CommonJS require.
  serverExternalPackages: ["tesseract.js"],
  // Next dev blocks cross-origin access to its HMR/JS dev resources by default;
  // testing through an ngrok tunnel needs the tunnel host explicitly allowed,
  // otherwise the page renders but client-side JS never hydrates (buttons don't respond).
  allowedDevOrigins: ["neglectfully-stageable-fermina.ngrok-free.dev"],
};

export default nextConfig;
