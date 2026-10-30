// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const messages = [
  { file: 'confirmation-code.html', purpose: /finish creating your account/i },
  { file: 'recovery-code.html', purpose: /password change or recovery/i },
]

test.each(messages)('$file renders a clear, self-contained code email', ({ file, purpose }) => {
  const template = readFileSync(new URL(file, import.meta.url), 'utf8')
  expect(template.match(/{{\s*\.Token\s*}}/g)).toHaveLength(1)

  for (const token of ['482719', '48271936']) {
    const html = template.replace(/{{\s*\.Token\s*}}/, token)
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.documentElement.lang).toBe('en')
    expect(document.body.textContent).toMatch(purpose)
    expect(document.getElementById('verification-code')?.textContent).toBe(token)
    expect(document.body.textContent?.match(new RegExp(token, 'g'))).toHaveLength(1)
    expect(document.querySelector('h1')?.textContent).toBeTruthy()
    expect(document.querySelector('table[role="presentation"]')).not.toBeNull()
    expect(document.querySelectorAll('script, img, link, a')).toHaveLength(0)
    expect(document.getElementById('verification-code')?.style.fontSize).toBe('32px')
    expect(document.body.textContent).not.toMatch(/all 8 digits|all 6 digits|expires in \d+/i)
  }
})
