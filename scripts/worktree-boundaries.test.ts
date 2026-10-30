import { afterAll, beforeAll, expect, test } from 'vitest'
import { spawnSync } from 'node:child_process'
import { join, resolve, sep } from 'node:path'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { ESLint } from 'eslint'
import ts from 'typescript'

let fixture: string
beforeAll(() => {
  mkdirSync('.worktrees', { recursive: true })
  fixture = mkdtempSync(resolve('.worktrees/oneliner-boundary-'))
  writeFileSync(join(fixture, 'probe.test.ts'), 'export const boundary = true\n')
})
afterAll(() => rmSync(fixture, { recursive: true, force: true }))

test('Vitest discovers this checkout without nested worktree tests', () => {
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly'], {
    encoding: 'utf8', timeout: 15_000,
  })
  expect(result.status, result.stderr).toBe(0)
  expect(result.stdout).toContain('scripts/worktree-boundaries.test.ts')
  expect(result.stdout).not.toContain('.worktrees/')
}, 20_000)

test('ESLint ignores nested worktrees while checking this checkout', async () => {
  const eslint = new ESLint()
  expect(await eslint.isPathIgnored(join(fixture, 'probe.test.ts'))).toBe(true)
  expect(await eslint.isPathIgnored(resolve('app/page.tsx'))).toBe(false)
})

test('TypeScript includes this checkout without nested worktree sources', () => {
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
  expect(config.error).toBeUndefined()
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
  expect(parsed.errors).toEqual([])
  expect(parsed.fileNames).toContain(resolve('scripts/worktree-boundaries.test.ts'))
  expect(parsed.fileNames.filter((file) => file.startsWith(resolve('.worktrees') + sep))).toEqual([])
})
