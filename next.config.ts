import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || `admin ${pkg.version}`,
  },
};

export default nextConfig;
