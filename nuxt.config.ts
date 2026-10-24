import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css", "~/assets/css/scoreboard.css", "~/assets/css/light-theme.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE,
    },
  },
  app: {
    baseURL: process.env.BASE_URL,
    head: {
      htmlAttrs: { lang: "zh-CN" },
      title: "TankTrouble · 坦克动荡",
      meta: [
        {
          name: "description",
          content: "多人联机版坦克动荡，最多支持 8 人一房间",
        },
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },
});
