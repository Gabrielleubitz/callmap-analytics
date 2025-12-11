/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Fix for node:process and other Node.js built-ins
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
      
      // Exclude firebase-admin and OpenTelemetry from client bundle
      // This prevents server-only packages from being bundled in client code
      const originalExternals = config.externals || []
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : []),
        ({ request }, callback) => {
          if (
            request?.includes('firebase-admin') ||
            request?.includes('@opentelemetry') ||
            request?.includes('opentelemetry') ||
            request === 'firebase-admin' ||
            request?.startsWith('@opentelemetry/')
          ) {
            return callback(null, `commonjs ${request}`)
          }
          if (typeof originalExternals === 'function') {
            return originalExternals({ request }, callback)
          }
          callback()
        },
      ]
    }
    return config
  },
}

module.exports = nextConfig

