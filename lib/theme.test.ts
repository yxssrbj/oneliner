import { expect, test } from 'vitest'
import { themeFromUserMetadata } from './theme'

test.each([undefined, null, 'light', [], 1, {}, { oneliner_theme: null }, { oneliner_theme: 'system' }, { oneliner_theme: 'LIGHT' }])('invalid metadata defaults to dark: %j', value => {
  expect(themeFromUserMetadata(value)).toBe('dark')
})
test.each(['dark', 'light'] as const)('reads only the theme preference: %s', theme => {
  expect(themeFromUserMetadata({ oneliner_theme: theme, role: 'irrelevant' })).toBe(theme)
})
