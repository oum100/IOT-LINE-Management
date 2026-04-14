import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  alias: {
    '#server': fileURLToPath(new URL('./server', import.meta.url))
  },
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '~~/*': ['./*'],
          '@@/*': ['./*']
        }
      }
    }
  },
  compatibilityDate: '2026-04-11',
  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],
  modules: [
    '@sidebase/nuxt-auth',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@nuxt/ui',
    [
      'nuxt-i18n-micro',
      {
        locales: [
          { code: 'en', iso: 'en-US', name: 'English', dir: 'ltr' },
          { code: 'th', iso: 'th-TH', name: 'ไทย', dir: 'ltr' }
        ],
        defaultLocale: 'th',
        translationDir: 'app/locales',
        meta: false,
        autoDetectLanguage: false,
        includeDefaultLocaleRoute: false,
        disablePageLocales: true
      }
    ],
    [
      '@nuxtjs/google-fonts',
      {
        families: {
          Kanit: [400, 500, 600, 700],
          'IBM Plex Sans Thai': [400, 500, 600]
        },
        display: 'swap',
        preload: true,
        prefetch: true,
        preconnect: true,
        download: true,
        inject: true
      }
    ]
  ],
  ui: {
    colorMode: true
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']
    }
  },
  runtimeConfig: {
    authSecret: process.env.AUTH_SECRET || '',
    authOrigin: process.env.AUTH_ORIGIN || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    lineLoginClientId: process.env.LINE_LOGIN_CLIENT_ID || '',
    lineLoginClientSecret: process.env.LINE_LOGIN_CLIENT_SECRET || '',
    authMagicLinkFrom: process.env.AUTH_MAGIC_LINK_FROM || '',
    databaseUrl: process.env.DATABASE_URL || '',
    qrPaymentMode: process.env.QR_PAYMENT_MODE || 'promptpay',
    promptPayTarget: process.env.PROMPTPAY_TARGET || '',
    maeManeeBillerId: process.env.MAEMANEE_BILLER_ID || '',
    maeManeeReferencePrefix: process.env.MAEMANEE_REFERENCE_PREFIX || 'ORD',
    maeManeeTemplatePayload: process.env.MAEMANEE_TEMPLATE_PAYLOAD || '',
    slip2GoBaseUrl: process.env.SLIP2GO_BASE_URL || 'https://connect.slip2go.com/api',
    slip2GoSecretKey: process.env.SLIP2GO_SECRET_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    paymentExpiryMinutes: Number(process.env.PAYMENT_EXPIRY_MINUTES || 15),
    adminApiKey: process.env.ADMIN_API_KEY || '',
    lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
    lineLiffId: process.env.LINE_LIFF_ID || '',
    public: {
      appName: 'Laundry Line IoT',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      lineLiffId: process.env.LINE_LIFF_ID || ''
    }
  },
  auth: {
    isEnabled: true,
    baseURL: '/api/auth',
    originEnvKey: 'AUTH_ORIGIN_DISABLED',
    provider: {
      type: 'authjs'
    },
    globalAppMiddleware: false
  },
  nitro: {
    externals: { inline: ['prom-client'] }
  }
})
