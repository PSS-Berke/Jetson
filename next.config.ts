import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Ignore ESLint errors during build (warnings are non-blocking)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Remove console.log statements in production for cleaner builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Optimize package imports for faster builds
  experimental: {
    optimizePackageImports: ['react-big-calendar', 'date-fns'],
  },
  // Configure webpack for better code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Separate PDF-related libraries into their own chunk
            pdf: {
              test: /[\\/]node_modules[\\/](react-to-print|jspdf|html2canvas)[\\/]/,
              name: 'pdf-libs',
              priority: 10,
            },
            // Separate calendar library into its own chunk
            calendar: {
              test: /[\\/]node_modules[\\/]react-big-calendar[\\/]/,
              name: 'calendar',
              priority: 10,
            },
            // Separate date utilities
            dateUtils: {
              test: /[\\/]node_modules[\\/]date-fns[\\/]/,
              name: 'date-utils',
              priority: 9,
            },
            // Common React libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'react-vendor',
              priority: 8,
            },
            // Other vendor libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 5,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
