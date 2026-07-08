/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep nodemailer and busboy as external packages (native Node.js modules)
  serverExternalPackages: ['nodemailer', 'busboy'],
};

module.exports = nextConfig;
