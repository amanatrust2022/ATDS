/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.122'],
  serverExternalPackages: ['node:sqlite'],
}

module.exports = nextConfig

