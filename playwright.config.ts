import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3012' },
  webServer: {
    command: 'npm run dev -- --port 3012',
    url: 'http://localhost:3012/sign-in',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
