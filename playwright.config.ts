import { defineConfig } from '@playwright/test'

const port = process.env.ONELINER_E2E_PORT ?? '3012'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
