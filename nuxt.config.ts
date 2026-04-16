import { defineNuxtConfig } from "nuxt/config";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const env = (name: string, fallback = "") =>
  (process.env[name] ?? fallback).trim();

export default defineNuxtConfig({
  alias: {
    "#server": fileURLToPath(new URL("./server", import.meta.url)),
  },
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          "~~/*": ["./*"],
          "@@/*": ["./*"],
        },
      },
    },
  },
  compatibilityDate: "2026-04-11",
  devtools: { enabled: true },
  css: ["./app/assets/css/main.css"],
  modules: [
    "@sidebase/nuxt-auth",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "@nuxt/ui",
    [
      "nuxt-i18n-micro",
      {
        locales: [
          { code: "en", iso: "en-US", name: "English", dir: "ltr" },
          { code: "th", iso: "th-TH", name: "ไทย", dir: "ltr" },
          { code: "lo", iso: "lo-LA", name: "ລາວ", dir: "ltr" },
          { code: "vi", iso: "vi-VN", name: "Tiếng Việt", dir: "ltr" },
        ],
        defaultLocale: "en",
        translationDir: "app/locales",
        localeCookie: "washpoint_locale",
        meta: false,
        autoDetectLanguage: false,
        includeDefaultLocaleRoute: false,
        disablePageLocales: true,
      },
    ],
    [
      "@nuxtjs/google-fonts",
      {
        families: {
          Kanit: [400, 500, 600, 700],
          "IBM Plex Sans Thai": [400, 500, 600],
        },
        display: "swap",
        preload: true,
        prefetch: true,
        preconnect: true,
        download: true,
        inject: true,
      },
    ],
  ],
  ui: {
    colorMode: true,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: [".trycloudflare.com", "localhost", "127.0.0.1"],
    },
  },
  runtimeConfig: {
    authSecret: env("AUTH_SECRET"),
    authOrigin: env("AUTH_ORIGIN"),
    githubClientId: env("GITHUB_CLIENT_ID"),
    githubClientSecret: env("GITHUB_CLIENT_SECRET"),
    googleClientId: env("GOOGLE_CLIENT_ID"),
    googleClientSecret: env("GOOGLE_CLIENT_SECRET"),
    lineLoginClientId: env("LINE_LOGIN_CLIENT_ID") || env("LINE_CLIENT_ID"),
    lineLoginClientSecret: env("LINE_LOGIN_CLIENT_SECRET") || env("LINE_CLIENT_SECRET"),
    authMagicLinkFrom: env("AUTH_MAGIC_LINK_FROM"),
    emailVerificationExpiresMinutes: Number(env("EMAIL_VERIFICATION_EXPIRES_MINUTES", "60")),
    passwordResetExpiresMinutes: Number(env("PASSWORD_RESET_EXPIRES_MINUTES", "30")),
    databaseUrl: env("DATABASE_URL"),
    qrPaymentMode: env("QR_PAYMENT_MODE", "promptpay"),
    promptPayTarget: env("PROMPTPAY_TARGET"),
    maeManeeBillerId: env("MAEMANEE_BILLER_ID"),
    maeManeeReferencePrefix: env("MAEMANEE_REFERENCE_PREFIX", "ORD"),
    maeManeeTemplatePayload: env("MAEMANEE_TEMPLATE_PAYLOAD"),
    slip2GoBaseUrl:
      env("SLIP2GO_BASE_URL") || "https://connect.slip2go.com/api",
    slip2GoSecretKey: env("SLIP2GO_SECRET_KEY"),
    resendApiKey: env("RESEND_API_KEY"),
    redisUrl: env("REDIS_URL", "redis://127.0.0.1:6379"),
    paymentExpiryMinutes: Number(env("PAYMENT_EXPIRY_MINUTES", "15")),
    adminApiKey: env("ADMIN_API_KEY"),
    lineChannelAccessToken: env("LINE_CHANNEL_ACCESS_TOKEN"),
    lineChannelSecret: env("LINE_CHANNEL_SECRET"),
    lineLiffId: env("LINE_LIFF_ID"),
    public: {
      appName: "Laundry Line IoT",
      appUrl: env("NUXT_PUBLIC_APP_URL", "http://localhost:3000"),
      lineLiffId: env("LINE_LIFF_ID"),
    },
  },
  auth: {
    isEnabled: true,
    baseURL: "/api/auth",
    // originEnvKey: "AUTH_ORIGIN_DISABLED",
    provider: {
      type: "authjs",
    },
    globalAppMiddleware: true,
  },
  nitro: {
    externals: { inline: ["prom-client"] },
  },
});
