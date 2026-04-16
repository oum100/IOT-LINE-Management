export type AppLocale = 'th' | 'en' | 'lo' | 'vi'

const LOCALES: AppLocale[] = ['th', 'en', 'lo', 'vi']

export function useAppLocale() {
  const locale = useState<AppLocale>('app-locale', () => 'th')

  const isReady = useState<boolean>('app-locale-ready', () => false)
  if (import.meta.client && !isReady.value) {
    const saved = (localStorage.getItem('app-locale') || '').toLowerCase()
    if (LOCALES.includes(saved as AppLocale)) {
      locale.value = saved as AppLocale
    }
    isReady.value = true
  }

  function setLocale(value: AppLocale) {
    locale.value = value
    if (import.meta.client) {
      localStorage.setItem('app-locale', value)
    }
  }

  function toggleLocale() {
    const current = LOCALES.indexOf(locale.value)
    const next = current < 0 ? 0 : (current + 1) % LOCALES.length
    setLocale(LOCALES[next]!)
  }

  function t(th: string, en: string) {
    if (locale.value === 'th') return th
    return en
  }

  return {
    locale,
    setLocale,
    toggleLocale,
    t
  }
}
