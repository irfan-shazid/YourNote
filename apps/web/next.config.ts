import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Cloudinary serves every note attachment and cover image.
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Google account avatars, used after a Google sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default config;
