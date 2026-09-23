import { translations, type Locale } from '~/utils/translations'

export function useI18n() {
  const localeCookie = useCookie<Locale>('soon-locale', {
    default: () => 'en',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  })
  const locale = useState<Locale>('soon-locale', () => localeCookie.value === 'zh' ? 'zh' : 'en')
  const t = computed(() => translations[locale.value])

  function setLocale(value: string) {
    locale.value = value === 'zh' ? 'zh' : 'en'
    localeCookie.value = locale.value
  }

  return { locale, t, setLocale }
}
