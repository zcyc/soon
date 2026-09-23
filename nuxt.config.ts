export default defineNuxtConfig({
  compatibilityDate: '2026-09-23',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  fonts: {
    providers: {
      adobe: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      google: false,
      googleicons: false,
      npm: false
    }
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'SOON — Screen Recording Made Simple',
      meta: [
        { name: 'description', content: 'Record and share screen videos in your browser.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBase: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
      recordingMaxDurationSeconds: 120
    }
  },
  vite: {
    build: {
      target: ['es2020', 'safari15']
    }
  }
})
