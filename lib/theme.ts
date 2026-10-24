export function themeFromUserMetadata(value: unknown): 'dark' | 'light' {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    'oneliner_theme' in value && value.oneliner_theme === 'light' ? 'light' : 'dark'
}
