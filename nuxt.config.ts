import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css', '~/assets/css/scoreboard.css', '~/assets/css/light-theme.css'],
  vite: {
    plugins: [tailwindcss(),],
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:33300', // 后端地址
    }
  },
})
